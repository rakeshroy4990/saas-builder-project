package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Map;

public record StructuredPrescriptionResponse(
        @JsonProperty("AppointmentId")
        String appointmentId,
        @JsonProperty("Status")
        String status,
        @JsonProperty("TemplateVersion")
        String templateVersion,
        @JsonProperty("Payload")
        Map<String, Object> payload,
        @JsonProperty("DraftEditable")
        boolean draftEditable,
        @JsonProperty("SignedAt")
        String signedAt,
        @JsonProperty("PdfSha256")
        String pdfSha256,
        @JsonProperty("SignatureVendor")
        String signatureVendor,
        @JsonProperty("SignatureAttestationId")
        String signatureAttestationId,
        @JsonProperty("SignatureMetadata")
        Map<String, Object> signatureMetadata,
        @JsonProperty("ValidationErrors")
        List<String> validationErrors
) {
}
