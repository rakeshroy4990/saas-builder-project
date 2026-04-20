package com.flexshell.prescription;

import java.util.Map;

public record SignatureResult(
        String vendor,
        String attestationId,
        Map<String, Object> metadata
) {}
