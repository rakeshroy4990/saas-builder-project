package com.flexshell.prescription;

import com.lowagie.text.Document;
import com.lowagie.text.DocumentException;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import org.springframework.stereotype.Component;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

/**
 * Server-side PDF for template {@value ClinicTelemedicinePrescriptionSchema#TEMPLATE_VERSION}. Layout is
 * intentionally simple and versioned with the JSON schema.
 */
@Component
public class ClinicPrescriptionPdfRenderer {

    public byte[] render(Map<String, Object> payload) {
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            Document doc = new Document(PageSize.A4, 40, 40, 40, 40);
            PdfWriter.getInstance(doc, out);
            doc.open();
            Font title = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 14);
            Font normal = FontFactory.getFont(FontFactory.HELVETICA, 10);
            Font small = FontFactory.getFont(FontFactory.HELVETICA_OBLIQUE, 8);

            doc.add(new Paragraph("E-PRESCRIPTION", title));
            doc.add(new Paragraph(
                    "Electronically generated clinical prescription. Valid only when finalized and signed by the treating practitioner.",
                    small));
            doc.add(new Paragraph(" "));

            doc.add(section("Consultation", normal));
            doc.add(line(
                    "Date & time: " + formatFriendlyDateTime(str(payload.get(ClinicTelemedicinePrescriptionSchema.KEY_CONSULTATION_DATE_TIME))),
                    normal));
            doc.add(line("Mode: " + str(payload.get(ClinicTelemedicinePrescriptionSchema.KEY_CONSULTATION_MODE)), normal));
            doc.add(new Paragraph(" "));

            Map<String, Object> clinic = child(payload, ClinicTelemedicinePrescriptionSchema.KEY_CLINIC);
            doc.add(section("Clinic / hospital", normal));
            doc.add(line(str(clinic.get(ClinicTelemedicinePrescriptionSchema.KEY_CLINIC_NAME)), normal));
            doc.add(line(str(clinic.get(ClinicTelemedicinePrescriptionSchema.KEY_CLINIC_ADDRESS)), normal));
            doc.add(line("Phone: " + str(clinic.get(ClinicTelemedicinePrescriptionSchema.KEY_CLINIC_PHONE)), normal));
            doc.add(new Paragraph(" "));

            Map<String, Object> prescriber = child(payload, ClinicTelemedicinePrescriptionSchema.KEY_PRESCRIBER);
            doc.add(section("Registered medical practitioner", normal));
            doc.add(line(str(prescriber.get(ClinicTelemedicinePrescriptionSchema.KEY_PRESCRIBER_DISPLAY_NAME)), normal));
            doc.add(line("Qualifications: " + str(prescriber.get(ClinicTelemedicinePrescriptionSchema.KEY_PRESCRIBER_QUALIFICATIONS)), normal));
            doc.add(line("SMC: " + str(prescriber.get(ClinicTelemedicinePrescriptionSchema.KEY_PRESCRIBER_SMC_NAME))
                    + " | Reg. no.: " + str(prescriber.get(ClinicTelemedicinePrescriptionSchema.KEY_PRESCRIBER_SMC_REGISTRATION)), normal));
            doc.add(new Paragraph(" "));

            Map<String, Object> patient = child(payload, ClinicTelemedicinePrescriptionSchema.KEY_PATIENT);
            doc.add(section("Patient", normal));
            doc.add(line("Name: " + str(patient.get(ClinicTelemedicinePrescriptionSchema.KEY_PATIENT_NAME)), normal));
            doc.add(line("Age / DOB: " + str(patient.get(ClinicTelemedicinePrescriptionSchema.KEY_PATIENT_AGE_OR_DOB))
                    + " | Sex: " + str(patient.get(ClinicTelemedicinePrescriptionSchema.KEY_PATIENT_SEX)), normal));
            doc.add(line("Address: " + str(patient.get(ClinicTelemedicinePrescriptionSchema.KEY_PATIENT_ADDRESS)), normal));
            doc.add(line("Phone: " + str(patient.get(ClinicTelemedicinePrescriptionSchema.KEY_PATIENT_PHONE)), normal));
            doc.add(new Paragraph(" "));

            doc.add(section("℞ Medicines", normal));
            PdfPTable table = new PdfPTable(new float[] {3f, 2f, 2f, 2f, 2f, 2f, 2f});
            table.setWidthPercentage(100);
            addHeader(table, "Drug", normal);
            addHeader(table, "Strength", normal);
            addHeader(table, "Dose", normal);
            addHeader(table, "Frequency", normal);
            addHeader(table, "Route", normal);
            addHeader(table, "Days", normal);
            addHeader(table, "Notes", normal);
            Object meds = payload.get(ClinicTelemedicinePrescriptionSchema.KEY_MEDICINES);
            if (meds instanceof List<?> list) {
                for (Object row : list) {
                    if (row instanceof Map<?, ?> m) {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> med = (Map<String, Object>) m;
                        addCell(table, str(med.get(ClinicTelemedicinePrescriptionSchema.KEY_MED_NAME)), normal);
                        addCell(table, str(med.get(ClinicTelemedicinePrescriptionSchema.KEY_MED_STRENGTH)), normal);
                        addCell(table, str(med.get(ClinicTelemedicinePrescriptionSchema.KEY_MED_DOSE)), normal);
                        addCell(table, str(med.get(ClinicTelemedicinePrescriptionSchema.KEY_MED_FREQUENCY)), normal);
                        addCell(table, str(med.get(ClinicTelemedicinePrescriptionSchema.KEY_MED_ROUTE)), normal);
                        addCell(table, str(med.get(ClinicTelemedicinePrescriptionSchema.KEY_MED_DURATION_DAYS)), normal);
                        addCell(table, str(med.get(ClinicTelemedicinePrescriptionSchema.KEY_MED_INSTRUCTIONS)), normal);
                    }
                }
            }
            doc.add(table);
            doc.add(new Paragraph(" "));

            doc.add(section("Advice", normal));
            doc.add(line("General: " + str(payload.get(ClinicTelemedicinePrescriptionSchema.KEY_GENERAL_ADVICE)), normal));
            doc.add(line("Follow-up: " + str(payload.get(ClinicTelemedicinePrescriptionSchema.KEY_FOLLOW_UP_ADVICE)), normal));

            doc.close();
            return out.toByteArray();
        } catch (DocumentException e) {
            throw new IllegalStateException("Unable to render prescription PDF", e);
        }
    }

    private static Paragraph section(String title, Font font) {
        Paragraph p = new Paragraph(title, FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11));
        p.setSpacingAfter(4f);
        return p;
    }

    private static Paragraph line(String text, Font font) {
        return new Paragraph(text == null ? "" : text, font);
    }

    private static void addHeader(PdfPTable table, String text, Font font) {
        PdfPCell c = new PdfPCell(new Phrase(text, font));
        c.setHorizontalAlignment(Element.ALIGN_CENTER);
        c.setBackgroundColor(new Color(0xE2, 0xE8, 0xF0));
        table.addCell(c);
    }

    private static void addCell(PdfPTable table, String text, Font font) {
        PdfPCell c = new PdfPCell(new Phrase(text == null ? "" : text, font));
        c.setHorizontalAlignment(Element.ALIGN_LEFT);
        table.addCell(c);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> child(Map<String, Object> payload, String key) {
        Object v = payload.get(key);
        if (v instanceof Map<?, ?> m) {
            return (Map<String, Object>) m;
        }
        return Map.of();
    }

    private static String str(Object v) {
        return v == null ? "" : String.valueOf(v).trim();
    }

    private static String formatFriendlyDateTime(String raw) {
        String input = str(raw);
        if (input.isEmpty()) return "";
        DateTimeFormatter out = DateTimeFormatter.ofPattern("dd MMM yyyy, hh:mm a z");
        try {
            Instant instant = Instant.parse(input);
            ZonedDateTime zdt = instant.atZone(ZoneId.systemDefault());
            return out.format(zdt);
        } catch (Exception ignored) {
            // Try local date-time formats if backend ever sends non-ISO instant.
        }
        try {
            LocalDateTime ldt = LocalDateTime.parse(input);
            return out.format(ldt.atZone(ZoneId.systemDefault()));
        } catch (Exception ignored) {
        }
        try {
            ZonedDateTime zdt = ZonedDateTime.parse(input);
            return out.format(zdt);
        } catch (Exception ignored) {
        }
        try {
            // Fallback for timestamps with trailing Z but no offset parsing support in earlier step.
            LocalDateTime ldt = LocalDateTime.parse(input.replace("Z", ""));
            return out.format(ldt.atZone(ZoneOffset.UTC).withZoneSameInstant(ZoneId.systemDefault()));
        } catch (Exception ignored) {
        }
        return input;
    }
}
