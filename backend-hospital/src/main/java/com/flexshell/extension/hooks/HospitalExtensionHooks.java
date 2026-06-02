package com.flexshell.extension.hooks;

import com.flexshell.extension.ExtensionContext;
import com.flexshell.extension.ExtensionHook;
import com.flexshell.extension.HookRegistry;
import com.flexshell.observability.ObservabilityLogger;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Hospital-specific L3 hook implementations (no PHI in logs).
 */
@Component
public class HospitalExtensionHooks {
    private static final Logger LOG = LoggerFactory.getLogger(HospitalExtensionHooks.class);

    public void registerAll(HookRegistry registry) {
        registry.register("enrich_appointment_metadata", enrichAppointmentMetadata());
        registry.register("log_appointment_audit", logAppointmentAudit());
        registry.register("sanitize_user_input", sanitizeUserInput());
        registry.register("validate_prescription_schema", validatePrescriptionSchema());
        registry.register("filter_pii_from_chat", filterPiiFromChat());
        registry.register("log_chat_audit", logChatAudit());
    }

    private ExtensionHook enrichAppointmentMetadata() {
        return (data, context) -> {
            Map<String, Object> out = new LinkedHashMap<>(data);
            out.put("extension_platform", context.get("userAgent"));
            out.put("extension_client_ip", context.get("clientIp"));
            out.put("extension_enriched_at", Instant.now().toString());
            return out;
        };
    }

    private ExtensionHook logAppointmentAudit() {
        return (data, context) -> {
            ObservabilityLogger.info(LOG, "extension_appointment_audit", Map.of(
                    "domain", "appointment",
                    "user_id", String.valueOf(context.get("userId")),
                    "stage", "after"
            ));
            return data;
        };
    }

    private ExtensionHook sanitizeUserInput() {
        return (data, context) -> {
            Map<String, Object> out = new LinkedHashMap<>();
            for (Map.Entry<String, Object> e : data.entrySet()) {
                if (e.getValue() instanceof String s) {
                    out.put(e.getKey(), s.trim());
                } else {
                    out.put(e.getKey(), e.getValue());
                }
            }
            return out;
        };
    }

    private ExtensionHook validatePrescriptionSchema() {
        return (data, context) -> data;
    }

    private ExtensionHook filterPiiFromChat() {
        return (data, context) -> data;
    }

    private ExtensionHook logChatAudit() {
        return (data, context) -> {
            ObservabilityLogger.info(LOG, "extension_chat_audit", Map.of(
                    "domain", "ai_chat",
                    "user_id", String.valueOf(context.get("userId"))
            ));
            return data;
        };
    }
}
