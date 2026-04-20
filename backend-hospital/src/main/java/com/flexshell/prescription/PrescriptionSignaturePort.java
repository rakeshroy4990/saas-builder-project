package com.flexshell.prescription;

import java.util.Map;

/**
 * Abstraction for a licensed CA / eSign ASP (DSC, Aadhaar eSign, etc.). Production wiring must be
 * approved by counsel and security; the default bean is a non-evidentiary placeholder.
 */
public interface PrescriptionSignaturePort {

    SignatureResult signPdfSha256(String pdfSha256Hex, String prescriberUserId, Map<String, String> auditContext);
}
