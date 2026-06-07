package com.flexshell.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flexshell.ai.AiProviderException;
import com.flexshell.ai.GeminiChatAdapter;
import com.flexshell.ai.OpenAiChatAdapter;
import com.flexshell.ai.SmartAiQuotaService;
import com.flexshell.controller.dto.EducationPrescriptionTranscribeData;
import com.flexshell.prescription.MedicalTermsGlossary;
import com.flexshell.prescription.MedicalTermsGlossaryNormalizer;
import com.flexshell.prescription.OpdPrintedFieldExtractor;
import com.flexshell.prescription.PrescriptionTranscribeTiming;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import jakarta.annotation.PostConstruct;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Base64;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

/**
 * Prescription image/PDF → structured diagnosis + medications for doctor education chat (no raw document logging).
 */
@Service
public class EducationPrescriptionTranscriptionService {
    private static final Logger LOG = LoggerFactory.getLogger(EducationPrescriptionTranscriptionService.class);
    private static final int MAX_BYTES = 12 * 1024 * 1024;
    private static final int MIN_PDF_TEXT_CHARS = 80;

    private final OpenAiChatAdapter openAiChatAdapter;
    private final GeminiChatAdapter geminiChatAdapter;
    private final SmartAiQuotaService smartAiQuotaService;
    private final ObjectMapper objectMapper;
    private final boolean consumeQuotaForEducationPrescriptionTranscribe;
    private final int pdfRenderDpi;
    private final int maxImageEdgePx;
    private final MedicalTermsGlossary medicalTermsGlossary;
    private final String prescriptionVisionOpenAiImageDetail;
    private final int prescriptionVisionTimeoutMs;
    private final int prescriptionVisionHttpRetries;

    public EducationPrescriptionTranscriptionService(
            OpenAiChatAdapter openAiChatAdapter,
            GeminiChatAdapter geminiChatAdapter,
            SmartAiQuotaService smartAiQuotaService,
            ObjectMapper objectMapper,
            MedicalTermsGlossary medicalTermsGlossary,
            @Value("${app.ai.smart.consume-quota-for-education-prescription-transcribe:false}")
            boolean consumeQuotaForEducationPrescriptionTranscribe,
            @Value("${app.ai.prescription-vision-render-dpi:120}") int pdfRenderDpi,
            @Value("${app.ai.prescription-vision-max-edge-px:900}") int maxImageEdgePx,
            @Value("${app.ai.prescription-vision-openai-image-detail:auto}") String prescriptionVisionOpenAiImageDetail,
            @Value("${app.ai.prescription-vision-timeout-ms:90000}") int prescriptionVisionTimeoutMs,
            @Value("${app.ai.prescription-vision-http-retries:2}") int prescriptionVisionHttpRetries
    ) {
        this.openAiChatAdapter = openAiChatAdapter;
        this.geminiChatAdapter = geminiChatAdapter;
        this.smartAiQuotaService = smartAiQuotaService;
        this.objectMapper = objectMapper;
        this.medicalTermsGlossary = medicalTermsGlossary;
        this.consumeQuotaForEducationPrescriptionTranscribe = consumeQuotaForEducationPrescriptionTranscribe;
        this.pdfRenderDpi = Math.min(200, Math.max(72, pdfRenderDpi));
        this.maxImageEdgePx = Math.min(4096, Math.max(768, maxImageEdgePx));
        this.prescriptionVisionOpenAiImageDetail =
                Objects.toString(prescriptionVisionOpenAiImageDetail, "auto").trim().toLowerCase(Locale.ROOT);
        this.prescriptionVisionTimeoutMs = Math.max(15_000, prescriptionVisionTimeoutMs);
        this.prescriptionVisionHttpRetries = Math.min(5, Math.max(0, prescriptionVisionHttpRetries));
    }

    @PostConstruct
    void logEffectivePrescriptionVisionConfig() {
        LOG.info(
                "education_prescription_vision_effective_config maxEdgePx={} renderDpi={} openAiImageDetail={} "
                        + "visionTimeoutMs={} httpRetries={} maxOpenAiAttempts={} glossaryEnabled={} "
                        + "(local: set OS env or application.properties; cloudrun-env.yaml is deploy-only)",
                maxImageEdgePx,
                pdfRenderDpi,
                prescriptionVisionOpenAiImageDetail,
                prescriptionVisionTimeoutMs,
                prescriptionVisionHttpRetries,
                1 + prescriptionVisionHttpRetries,
                medicalTermsGlossary.isEnabled()
        );
    }

    public EducationPrescriptionTranscribeData transcribe(String userId, MultipartFile file) {
        PrescriptionTranscribeTiming timing = PrescriptionTranscribeTiming.start();
        try {
            return doTranscribe(userId, file, timing);
        } catch (RuntimeException ex) {
            LOG.warn(
                    "education_prescription_transcribe_failed errorType={} message={}",
                    ex.getClass().getSimpleName(),
                    Objects.toString(ex.getMessage(), "").trim()
            );
            throw ex;
        } finally {
            timing.logSummary(LOG);
        }
    }

    private EducationPrescriptionTranscribeData doTranscribe(
            String userId,
            MultipartFile file,
            PrescriptionTranscribeTiming timing
    ) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("PATIENT_PRESCRIPTION_FILE_REQUIRED");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new IllegalArgumentException("EDUCATION_PRESCRIPTION_FILE_TOO_LARGE");
        }
        byte[] bytes = timing.record("read_upload_bytes", () -> {
            try {
                return file.getBytes();
            } catch (IOException ex) {
                throw new IllegalArgumentException("PATIENT_PRESCRIPTION_FILE_READ_FAILED");
            }
        });
        if (bytes.length == 0) {
            throw new IllegalArgumentException("PATIENT_PRESCRIPTION_FILE_REQUIRED");
        }
        String sniffed = timing.record("sniff_mime", () -> sniffMime(bytes));
        String declared = Objects.toString(file.getContentType(), "").trim().toLowerCase(Locale.ROOT);
        String effectiveMime = !sniffed.isBlank() ? sniffed : declared;

        if ("application/pdf".equals(effectiveMime)) {
            // ok
        } else if (effectiveMime.startsWith("image/")) {
            validateRasterMime(effectiveMime);
        } else {
            throw new IllegalArgumentException("EDUCATION_PRESCRIPTION_UNSUPPORTED_FILE_TYPE");
        }

        if (consumeQuotaForEducationPrescriptionTranscribe) {
            timing.record("quota_check", () -> smartAiQuotaService.consumeDailyRequestOrThrow(userId));
        }

        timing.context(effectiveMime, bytes.length, "application/pdf".equals(effectiveMime) ? "pdf" : "image");
        LOG.info(
                "education_prescription_transcribe_start mime={} fileBytes={} maxEdgePx={} openAiImageDetail={}",
                effectiveMime,
                bytes.length,
                maxImageEdgePx,
                prescriptionVisionOpenAiImageDetail
        );
        if ("application/pdf".equals(effectiveMime)) {
            return transcribePdf(bytes, timing);
        }
        return transcribeImageBytes(effectiveMime, bytes, timing);
    }

    private void validateRasterMime(String mime) {
        if (mime.contains("jpeg")
                || mime.contains("jpg")
                || mime.contains("png")
                || mime.contains("webp")
                || mime.contains("gif")
                || mime.contains("heic")
                || mime.contains("heif")) {
            return;
        }
        throw new IllegalArgumentException("EDUCATION_PRESCRIPTION_UNSUPPORTED_IMAGE_TYPE");
    }

    private EducationPrescriptionTranscribeData transcribePdf(byte[] pdfBytes, PrescriptionTranscribeTiming timing) {
        return timing.record("pdf_total", () -> {
            try (PDDocument doc = Loader.loadPDF(pdfBytes)) {
                int pages = doc.getNumberOfPages();
                if (pages <= 0) {
                    throw new IllegalArgumentException("EDUCATION_PRESCRIPTION_PDF_EMPTY");
                }
                PDFTextStripper stripper = new PDFTextStripper();
                stripper.setStartPage(1);
                stripper.setEndPage(Math.min(3, pages));
                String extracted = timing.record("pdf_text_extract", () -> {
                    try {
                        return Objects.toString(stripper.getText(doc), "").trim();
                    } catch (IOException ex) {
                        throw new IllegalArgumentException("EDUCATION_PRESCRIPTION_PDF_READ_FAILED");
                    }
                });
                if (extracted.length() >= MIN_PDF_TEXT_CHARS) {
                    timing.context("application/pdf", pdfBytes.length, "pdf_text_llm");
                    EducationPrescriptionTranscribeData structured = timing.record(
                            "pdf_text_llm_total",
                            () -> structurePlainTextWithLlm(collapseBlankLines(extracted), timing)
                    );
                    return timing.record(
                            "opd_enrich",
                            () -> finishTranscribe(OpdPrintedFieldExtractor.enrich(structured, extracted), timing)
                    );
                }
                timing.context("application/pdf", pdfBytes.length, "pdf_vision");
                byte[] jpeg = timing.record("pdf_render_jpeg", () -> {
                    try {
                        PDFRenderer renderer = new PDFRenderer(doc);
                        BufferedImage rendered = renderer.renderImageWithDPI(0, pdfRenderDpi, ImageType.RGB);
                        BufferedImage scaled = constrainMaxEdge(rendered, maxImageEdgePx);
                        return toJpegBytes(scaled, 0.88f);
                    } catch (IOException ex) {
                        throw new IllegalArgumentException("EDUCATION_PRESCRIPTION_PDF_IMAGE_FAILED");
                    }
                });
                LOG.info(
                        "education_prescription_transcribe mode=pdf_vision dpi={} maxEdge={} jpegBytes={}",
                        pdfRenderDpi,
                        maxImageEdgePx,
                        jpeg.length);
                String visionJson = timing.record("vision_llm_total", () -> visionTranscribe("image/jpeg", jpeg, timing));
                EducationPrescriptionTranscribeData vision = parsePrescriptionJson(visionJson);
                return timing.record(
                        "opd_enrich",
                        () -> finishTranscribe(OpdPrintedFieldExtractor.enrich(vision, extracted), timing)
                );
            } catch (IOException ex) {
                throw new IllegalArgumentException("EDUCATION_PRESCRIPTION_PDF_READ_FAILED");
            }
        });
    }

    private EducationPrescriptionTranscribeData transcribeImageBytes(
            String mime,
            byte[] imageBytes,
            PrescriptionTranscribeTiming timing
    ) {
        return timing.record("image_total", () -> {
            BufferedImage probe = timing.record("image_decode", () -> {
                try {
                    return ImageIO.read(new ByteArrayInputStream(imageBytes));
                } catch (IOException ex) {
                    return null;
                }
            });
            if (probe == null) {
                throw new IllegalArgumentException("EDUCATION_PRESCRIPTION_IMAGE_DECODE_FAILED");
            }
            byte[] jpegBytes = timing.record("image_preprocess_jpeg", () -> {
                BufferedImage rgb = toRgb(probe);
                BufferedImage scaled = constrainMaxEdge(rgb, maxImageEdgePx);
                try {
                    return toJpegBytes(scaled, 0.88f);
                } catch (IOException ex) {
                    throw new IllegalArgumentException("EDUCATION_PRESCRIPTION_IMAGE_PROCESS_FAILED");
                }
            });
            LOG.info(
                    "education_prescription_transcribe mode=image mime={} jpegBytes={} maxEdge={}",
                    mime,
                    jpegBytes.length,
                    maxImageEdgePx);
            String visionJson = timing.record("vision_llm_total", () -> visionTranscribe("image/jpeg", jpegBytes, timing));
            EducationPrescriptionTranscribeData vision = parsePrescriptionJson(visionJson);
            return timing.record(
                    "split_age_gender",
                    () -> finishTranscribe(OpdPrintedFieldExtractor.splitAgeGenderIfNeeded(vision), timing)
            );
        });
    }

    private EducationPrescriptionTranscribeData finishTranscribe(
            EducationPrescriptionTranscribeData data,
            PrescriptionTranscribeTiming timing
    ) {
        return timing.record("medical_glossary", () -> MedicalTermsGlossaryNormalizer.normalize(data, medicalTermsGlossary));
    }

    private EducationPrescriptionTranscribeData finishTranscribe(EducationPrescriptionTranscribeData data) {
        PrescriptionTranscribeTiming timing = PrescriptionTranscribeTiming.currentOrNull();
        if (timing != null) {
            return finishTranscribe(data, timing);
        }
        return MedicalTermsGlossaryNormalizer.normalize(data, medicalTermsGlossary);
    }

    private EducationPrescriptionTranscribeData structurePlainTextWithLlm(String text, PrescriptionTranscribeTiming timing) {
        try {
            String json = timing.record("text_llm_openai", () ->
                    openAiChatAdapter.extractPrescriptionDiagnosisMedicationsJsonFromPlainText(text));
            return finishTranscribe(parsePrescriptionJson(json), timing);
        } catch (AiProviderException ex) {
            if (ex.kind() != AiProviderException.Kind.CONFIG_MISSING) {
                throw ex;
            }
        }
        String json = timing.record("text_llm_gemini", () ->
                geminiChatAdapter.extractPrescriptionDiagnosisMedicationsJsonFromPlainText(text));
        return finishTranscribe(parsePrescriptionJson(json), timing);
    }

    private String visionTranscribe(String mime, byte[] imageBytes, PrescriptionTranscribeTiming timing) {
        String b64 = timing.record("vision_base64_encode", () -> Base64.getEncoder().encodeToString(imageBytes));
        String dataUrl = "data:" + mime + ";base64," + b64;
        try {
            return timing.record("vision_llm_openai", () -> openAiChatAdapter.transcribePrescriptionFromImageDataUrl(dataUrl));
        } catch (AiProviderException ex) {
            if (ex.kind() != AiProviderException.Kind.CONFIG_MISSING) {
                throw ex;
            }
        }
        return timing.record("vision_llm_gemini", () -> geminiChatAdapter.transcribePrescriptionFromInlineImage(mime, b64));
    }

    private EducationPrescriptionTranscribeData parsePrescriptionJson(String rawModelOutput) {
        PrescriptionTranscribeTiming timing = PrescriptionTranscribeTiming.currentOrNull();
        if (timing != null) {
            return timing.record("parse_json", () -> parsePrescriptionJsonBody(rawModelOutput));
        }
        return parsePrescriptionJsonBody(rawModelOutput);
    }

    private EducationPrescriptionTranscribeData parsePrescriptionJsonBody(String rawModelOutput) {
        String trimmed = Objects.toString(rawModelOutput, "").trim();
        if (trimmed.isBlank()) {
            LOG.warn("education_prescription_parse_failed reason=empty_model_output");
            throw new IllegalArgumentException("EDUCATION_PRESCRIPTION_MODEL_PARSE_FAILED");
        }
        String cleaned = stripJsonFences(trimmed);
        try {
            return buildTranscribeDataFromJson(objectMapper.readTree(cleaned));
        } catch (JsonProcessingException ex) {
            String sliced = sliceFirstBalancedJsonObject(cleaned);
            if (!sliced.equals(cleaned)) {
                try {
                    return buildTranscribeDataFromJson(objectMapper.readTree(sliced));
                } catch (JsonProcessingException ignored) {
                    // fall through to warn + client error
                }
            }
            LOG.warn(
                    "education_prescription_parse_failed reason=json len={} ex={}",
                    cleaned.length(),
                    ex.getClass().getSimpleName());
            throw new IllegalArgumentException("EDUCATION_PRESCRIPTION_MODEL_PARSE_FAILED");
        }
    }

    private EducationPrescriptionTranscribeData buildTranscribeDataFromJson(JsonNode n) {
        EducationPrescriptionTranscribeData parsed =
                OpdPrintedFieldExtractor.splitAgeGenderIfNeeded(PrescriptionExtractionJsonParser.fromJson(n));
        String diagnosis = parsed.diagnosis().isBlank() ? "Not stated" : parsed.diagnosis();
        String medications = parsed.medications();
        if (medications.isBlank() && parsed.medicines().isEmpty()) {
            medications = "Not stated";
        } else if (medications.isBlank()) {
            medications = String.join("\n", parsed.medicines());
        }
        return new EducationPrescriptionTranscribeData(
                parsed.hospitalName(),
                parsed.documentType(),
                parsed.registrationNumber(),
                parsed.receiptNumber(),
                parsed.appointmentDate(),
                parsed.patientName(),
                parsed.patientAge(),
                parsed.patientGender(),
                parsed.ageGender(),
                parsed.department(),
                parsed.consultant(),
                parsed.address(),
                parsed.mobileNumber(),
                parsed.referredBy(),
                diagnosis,
                medications,
                parsed.medicines(),
                parsed.dosage(),
                parsed.advice(),
                parsed.doctorName(),
                parsed.prescriptionDate(),
                parsed.notes()
        );
    }

    /**
     * When the model prefixes prose (e.g. "Here is the JSON:"), take the first top-level JSON object by brace matching
     * (string-aware) so we do not log raw clinical text.
     */
    private static String sliceFirstBalancedJsonObject(String s) {
        int start = s.indexOf('{');
        if (start < 0) {
            return s;
        }
        int depth = 0;
        boolean inStr = false;
        boolean esc = false;
        for (int i = start; i < s.length(); i++) {
            char c = s.charAt(i);
            if (inStr) {
                if (esc) {
                    esc = false;
                    continue;
                }
                if (c == '\\') {
                    esc = true;
                    continue;
                }
                if (c == '"') {
                    inStr = false;
                }
                continue;
            }
            if (c == '"') {
                inStr = true;
                continue;
            }
            if (c == '{') {
                depth++;
            } else if (c == '}') {
                depth--;
                if (depth == 0) {
                    return s.substring(start, i + 1);
                }
            }
        }
        return s;
    }

    /**
     * Same heuristics as the hospital web client: split OCR narrative on Diagnosis / Medications headings.
     */
    static EducationPrescriptionTranscribeData extractDiagnosisMedicationsFromPlainText(String raw) {
        if (raw == null || raw.isBlank()) {
            return legacyPlainTextFallback("Not stated", "Not stated", List.of());
        }
        String text = raw.replace("\r\n", "\n").trim();
        java.util.regex.Pattern medSep = java.util.regex.Pattern.compile("(?i)\\n\\s*Medications\\s*:\\s*");
        java.util.regex.Matcher medM = medSep.matcher(text);
        String diagnosis = "";
        String medications = "";
        if (medM.find()) {
            String head = text.substring(0, medM.start());
            medications = text.substring(medM.end()).trim();
            java.util.regex.Pattern diagPat = java.util.regex.Pattern.compile("(?is)\\bDiagnosis\\s*:\\s*(.*)$");
            java.util.regex.Matcher diagMatch = diagPat.matcher(head);
            if (diagMatch.find()) {
                diagnosis = diagMatch.group(1).trim();
            }
        } else {
            java.util.regex.Pattern diagPat2 = java.util.regex.Pattern.compile("(?is)\\bDiagnosis\\s*:\\s*(.*)$");
            java.util.regex.Matcher d2 = diagPat2.matcher(text);
            if (d2.find()) {
                diagnosis = d2.group(1).trim();
            }
        }
        medications = medications
                .replaceAll("(?is)\\n\\s*Prescriber signature\\s*:.*$", "")
                .replaceAll("(?is)\\n\\s*(?:Doctor|Physician)\\s+signature\\s*:.*$", "")
                .trim();
        if (diagnosis.isBlank()) {
            diagnosis = "Not stated";
        }
        if (medications.isBlank()) {
            medications = "Not stated";
        }
        List<String> medicineLines = splitPlainMedicationLines(medications);
        return legacyPlainTextFallback(diagnosis, medications, medicineLines);
    }

    private static EducationPrescriptionTranscribeData legacyPlainTextFallback(
            String diagnosis,
            String medications,
            List<String> medicineLines
    ) {
        return new EducationPrescriptionTranscribeData(
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                diagnosis,
                medications,
                medicineLines,
                List.of(),
                List.of(),
                "",
                "",
                ""
        );
    }

    private static List<String> splitPlainMedicationLines(String medications) {
        String text = Objects.toString(medications, "").trim();
        if (text.isBlank() || "Not stated".equalsIgnoreCase(text)) {
            return List.of();
        }
        List<String> lines = new java.util.ArrayList<>();
        for (String line : text.split("\\r?\\n")) {
            String t = line.trim();
            if (!t.isBlank()) {
                lines.add(t);
            }
        }
        return lines.isEmpty() ? List.of(text) : lines;
    }

    private static String stripJsonFences(String raw) {
        String t = raw.trim();
        if (!t.startsWith("```")) {
            return t;
        }
        int firstNl = t.indexOf('\n');
        if (firstNl > 0) {
            t = t.substring(firstNl + 1);
        }
        int fence = t.lastIndexOf("```");
        if (fence >= 0) {
            t = t.substring(0, fence).trim();
        }
        return t.trim();
    }

    private static String sniffMime(byte[] b) {
        if (b.length >= 5 && b[0] == '%' && b[1] == 'P' && b[2] == 'D' && b[3] == 'F') {
            return "application/pdf";
        }
        if (b.length >= 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8) {
            return "image/jpeg";
        }
        if (b.length >= 8
                && b[0] == (byte) 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G'
                && b[4] == '\r' && b[5] == '\n' && b[6] == 0x1A && b[7] == '\n') {
            return "image/png";
        }
        if (b.length >= 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F') {
            return "image/webp";
        }
        return "";
    }

    private static String collapseBlankLines(String text) {
        String[] lines = text.split("\\R");
        StringBuilder sb = new StringBuilder();
        boolean lastBlank = true;
        for (String line : lines) {
            String t = line.trim();
            if (t.isEmpty()) {
                if (!lastBlank) {
                    sb.append('\n');
                }
                lastBlank = true;
            } else {
                if (sb.length() > 0 && !lastBlank) {
                    sb.append('\n');
                }
                sb.append(t);
                lastBlank = false;
            }
        }
        return sb.toString().trim();
    }

    private static BufferedImage toRgb(BufferedImage src) {
        if (src.getType() == BufferedImage.TYPE_INT_RGB) {
            return src;
        }
        BufferedImage rgb = new BufferedImage(src.getWidth(), src.getHeight(), BufferedImage.TYPE_INT_RGB);
        Graphics2D g = rgb.createGraphics();
        g.drawImage(src, 0, 0, null);
        g.dispose();
        return rgb;
    }

    private static BufferedImage constrainMaxEdge(BufferedImage src, int maxEdge) {
        int w = src.getWidth();
        int h = src.getHeight();
        if (w <= maxEdge && h <= maxEdge) {
            return src;
        }
        double scale = Math.min((double) maxEdge / w, (double) maxEdge / h);
        int nw = Math.max(1, (int) Math.round(w * scale));
        int nh = Math.max(1, (int) Math.round(h * scale));
        BufferedImage out = new BufferedImage(nw, nh, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        g.drawImage(src, 0, 0, nw, nh, null);
        g.dispose();
        return out;
    }

    private static byte[] toJpegBytes(BufferedImage img, float quality) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        Iterator<ImageWriter> writers = ImageIO.getImageWritersByFormatName("jpg");
        if (!writers.hasNext()) {
            return toPngBytes(img);
        }
        ImageWriter writer = writers.next();
        ImageWriteParam param = writer.getDefaultWriteParam();
        if (param.canWriteCompressed()) {
            param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            param.setCompressionQuality(Math.min(1f, Math.max(0.5f, quality)));
        }
        try (ImageOutputStream ios = ImageIO.createImageOutputStream(baos)) {
            writer.setOutput(ios);
            writer.write(null, new IIOImage(img, null, null), param);
        } finally {
            writer.dispose();
        }
        return baos.toByteArray();
    }

    private static byte[] toPngBytes(BufferedImage img) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ImageIO.write(img, "png", baos);
        return baos.toByteArray();
    }
}
