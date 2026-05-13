package com.flexshell.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flexshell.ai.AiProviderException;
import com.flexshell.ai.GeminiChatAdapter;
import com.flexshell.ai.OpenAiChatAdapter;
import com.flexshell.ai.SmartAiQuotaService;
import com.flexshell.controller.dto.EducationPrescriptionTranscribeData;
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

import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Base64;
import java.util.Iterator;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

/**
 * Prescription image/PDF → structured diagnosis + medications for doctor education chat (no raw document logging).
 */
@Service
public class EducationPrescriptionTranscriptionService {
    private static final Logger LOG = LoggerFactory.getLogger(EducationPrescriptionTranscriptionService.class);
    private static final int MAX_BYTES = 12 * 1024 * 1024;
    private static final int MIN_PDF_TEXT_CHARS = 80;
    private static final int PDF_RENDER_DPI = 144;
    private static final int MAX_IMAGE_EDGE = 2048;

    private final OpenAiChatAdapter openAiChatAdapter;
    private final GeminiChatAdapter geminiChatAdapter;
    private final SmartAiQuotaService smartAiQuotaService;
    private final ObjectMapper objectMapper;
    private final boolean consumeQuotaForEducationPrescriptionTranscribe;

    public EducationPrescriptionTranscriptionService(
            OpenAiChatAdapter openAiChatAdapter,
            GeminiChatAdapter geminiChatAdapter,
            SmartAiQuotaService smartAiQuotaService,
            ObjectMapper objectMapper,
            @Value("${app.ai.smart.consume-quota-for-education-prescription-transcribe:false}")
            boolean consumeQuotaForEducationPrescriptionTranscribe
    ) {
        this.openAiChatAdapter = openAiChatAdapter;
        this.geminiChatAdapter = geminiChatAdapter;
        this.smartAiQuotaService = smartAiQuotaService;
        this.objectMapper = objectMapper;
        this.consumeQuotaForEducationPrescriptionTranscribe = consumeQuotaForEducationPrescriptionTranscribe;
    }

    public EducationPrescriptionTranscribeData transcribe(String userId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("A non-empty file is required.");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new IllegalArgumentException("File is too large (max 12 MB).");
        }
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException ex) {
            throw new IllegalArgumentException("Could not read uploaded file.");
        }
        if (bytes.length == 0) {
            throw new IllegalArgumentException("A non-empty file is required.");
        }
        String sniffed = sniffMime(bytes);
        String declared = Objects.toString(file.getContentType(), "").trim().toLowerCase(Locale.ROOT);
        String effectiveMime = !sniffed.isBlank() ? sniffed : declared;

        if ("application/pdf".equals(effectiveMime)) {
            // ok
        } else if (effectiveMime.startsWith("image/")) {
            validateRasterMime(effectiveMime);
        } else {
            throw new IllegalArgumentException("Unsupported file type. Use PDF, JPEG, PNG, or WebP.");
        }

        if (consumeQuotaForEducationPrescriptionTranscribe) {
            smartAiQuotaService.consumeDailyRequestOrThrow(userId);
        }

        if ("application/pdf".equals(effectiveMime)) {
            return transcribePdf(bytes);
        }
        return transcribeImageBytes(effectiveMime, bytes);
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
        throw new IllegalArgumentException("Unsupported image type. Use JPEG, PNG, WebP, or GIF.");
    }

    private EducationPrescriptionTranscribeData transcribePdf(byte[] pdfBytes) {
        try (PDDocument doc = Loader.loadPDF(pdfBytes)) {
            int pages = doc.getNumberOfPages();
            if (pages <= 0) {
                throw new IllegalArgumentException("PDF has no pages.");
            }
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setStartPage(1);
            stripper.setEndPage(Math.min(3, pages));
            String extracted = Objects.toString(stripper.getText(doc), "").trim();
            if (extracted.length() >= MIN_PDF_TEXT_CHARS) {
                return structurePlainTextWithLlm(collapseBlankLines(extracted));
            }
            PDFRenderer renderer = new PDFRenderer(doc);
            BufferedImage rendered = renderer.renderImageWithDPI(0, PDF_RENDER_DPI, ImageType.RGB);
            BufferedImage scaled = constrainImage(rendered);
            byte[] png = toPngBytes(scaled);
            LOG.info("education_prescription_transcribe mode=pdf_vision bytes={}", png.length);
            return parsePrescriptionJson(visionTranscribe("image/png", png));
        } catch (IOException ex) {
            throw new IllegalArgumentException("Could not read PDF.");
        }
    }

    private EducationPrescriptionTranscribeData transcribeImageBytes(String mime, byte[] imageBytes) {
        BufferedImage probe;
        try {
            probe = ImageIO.read(new ByteArrayInputStream(imageBytes));
        } catch (IOException ex) {
            probe = null;
        }
        if (probe == null) {
            throw new IllegalArgumentException("Could not decode image.");
        }
        BufferedImage rgb = toRgb(probe);
        BufferedImage scaled = constrainImage(rgb);
        byte[] pngBytes;
        try {
            pngBytes = toPngBytes(scaled);
        } catch (IOException ex) {
            throw new IllegalArgumentException("Could not process image.");
        }
        LOG.info("education_prescription_transcribe mode=image mime={} pngBytes={}", mime, pngBytes.length);
        return parsePrescriptionJson(visionTranscribe("image/png", pngBytes));
    }

    private EducationPrescriptionTranscribeData structurePlainTextWithLlm(String text) {
        try {
            String json = openAiChatAdapter.extractPrescriptionDiagnosisMedicationsJsonFromPlainText(text);
            return parsePrescriptionJson(json);
        } catch (AiProviderException ex) {
            if (ex.kind() != AiProviderException.Kind.CONFIG_MISSING) {
                throw ex;
            }
        }
        String json = geminiChatAdapter.extractPrescriptionDiagnosisMedicationsJsonFromPlainText(text);
        return parsePrescriptionJson(json);
    }

    private String visionTranscribe(String mime, byte[] imageBytes) {
        String b64 = Base64.getEncoder().encodeToString(imageBytes);
        String dataUrl = "data:" + mime + ";base64," + b64;
        try {
            return openAiChatAdapter.transcribePrescriptionFromImageDataUrl(dataUrl);
        } catch (AiProviderException ex) {
            if (ex.kind() != AiProviderException.Kind.CONFIG_MISSING) {
                throw ex;
            }
        }
        return geminiChatAdapter.transcribePrescriptionFromInlineImage(mime, b64);
    }

    private EducationPrescriptionTranscribeData parsePrescriptionJson(String rawModelOutput) {
        try {
            String cleaned = stripJsonFences(rawModelOutput.trim());
            JsonNode n = objectMapper.readTree(cleaned);
            if (!n.isObject()) {
                throw new IllegalArgumentException("Prescription model output was not valid JSON.");
            }
            String d = pickJsonStringField(n, "diagnosis");
            String m = pickJsonStringField(n, "medications");
            String textBlob = pickJsonStringField(n, "text");
            if (d.isBlank() && m.isBlank() && !textBlob.isBlank()) {
                EducationPrescriptionTranscribeData fromText = extractDiagnosisMedicationsFromPlainText(textBlob);
                d = fromText.diagnosis();
                m = fromText.medications();
            } else if (!textBlob.isBlank()) {
                EducationPrescriptionTranscribeData fromText = extractDiagnosisMedicationsFromPlainText(textBlob);
                if (d.isBlank()) {
                    d = fromText.diagnosis();
                }
                if (m.isBlank()) {
                    m = fromText.medications();
                }
            }
            if (d.isBlank()) {
                d = "Not stated";
            }
            if (m.isBlank()) {
                m = "Not stated";
            }
            return new EducationPrescriptionTranscribeData(d, m);
        } catch (JsonProcessingException ex) {
            throw new IllegalArgumentException("Could not parse prescription model output.");
        }
    }

    /**
     * Same heuristics as the hospital web client: split OCR narrative on Diagnosis / Medications headings.
     */
    static EducationPrescriptionTranscribeData extractDiagnosisMedicationsFromPlainText(String raw) {
        if (raw == null || raw.isBlank()) {
            return new EducationPrescriptionTranscribeData("Not stated", "Not stated");
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
        return new EducationPrescriptionTranscribeData(diagnosis, medications);
    }

    private static String pickJsonStringField(JsonNode object, String key) {
        Iterator<Map.Entry<String, JsonNode>> it = object.fields();
        while (it.hasNext()) {
            Map.Entry<String, JsonNode> e = it.next();
            if (e.getKey().equalsIgnoreCase(key)) {
                JsonNode v = e.getValue();
                if (v == null || v.isNull()) {
                    return "";
                }
                if (v.isTextual()) {
                    return v.asText("").trim();
                }
                if (v.isNumber()) {
                    return v.asText().trim();
                }
                return v.toString().trim();
            }
        }
        return "";
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

    private static BufferedImage constrainImage(BufferedImage src) {
        int w = src.getWidth();
        int h = src.getHeight();
        if (w <= MAX_IMAGE_EDGE && h <= MAX_IMAGE_EDGE) {
            return src;
        }
        double scale = Math.min((double) MAX_IMAGE_EDGE / w, (double) MAX_IMAGE_EDGE / h);
        int nw = Math.max(1, (int) Math.round(w * scale));
        int nh = Math.max(1, (int) Math.round(h * scale));
        BufferedImage out = new BufferedImage(nw, nh, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        g.drawImage(src, 0, 0, nw, nh, null);
        g.dispose();
        return out;
    }

    private static byte[] toPngBytes(BufferedImage img) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ImageIO.write(img, "png", baos);
        return baos.toByteArray();
    }
}
