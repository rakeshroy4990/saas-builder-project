package com.flexshell.prescription;

import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Component
public class PlaceholderPrescriptionSignatureAdapter implements PrescriptionSignaturePort {

    public static final String VENDOR = "PLACEHOLDER_ASP";

    @Override
    public SignatureResult signPdfSha256(String pdfSha256Hex, String prescriberUserId, Map<String, String> auditContext) {
        String attestationId = UUID.randomUUID().toString();
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("vendor", VENDOR);
        metadata.put("documentSha256", pdfSha256Hex);
        metadata.put("prescriberUserId", prescriberUserId);
        metadata.put("attestationId", attestationId);
        if (auditContext != null) {
            auditContext.forEach(metadata::put);
        }
        metadata.put("notice", "Placeholder signer only — replace with counsel-approved CA/eSign integration.");
        return new SignatureResult(VENDOR, attestationId, metadata);
    }
}
