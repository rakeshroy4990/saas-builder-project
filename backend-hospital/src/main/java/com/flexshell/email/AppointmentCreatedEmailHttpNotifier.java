package com.flexshell.email;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flexshell.controller.dto.AppointmentResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

@Component
public class AppointmentCreatedEmailHttpNotifier implements AppointmentCreatedEmailNotifier {

    private static final Logger log = LoggerFactory.getLogger(AppointmentCreatedEmailHttpNotifier.class);
    private static final int MAX_DETAIL = 500;
    private static final String DOCTOR_EMAIL_FAILED_DETAIL = "DOCTOR_EMAIL_FAILED";

    private final AppEmailProperties properties;
    private final ObjectMapper objectMapper;

    public AppointmentCreatedEmailHttpNotifier(
            AppEmailProperties properties,
            ObjectMapper objectMapper
    ) {
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    @Override
    public AppointmentEmailNotifyOutcome notifyAppointmentCreated(AppointmentResponse appointment, String doctorEmail) {
        try {
            return notifyInternal(appointment, doctorEmail);
        } catch (Exception ex) {
            log.warn("Unexpected error while sending appointment-created emails: {}", ex.getMessage());
            return AppointmentEmailNotifyOutcome.failed(truncate(ex.getMessage(), MAX_DETAIL));
        }
    }

    private AppointmentEmailNotifyOutcome notifyInternal(AppointmentResponse appointment, String doctorEmail) {
        if (!properties.isEnabled()) {
            return AppointmentEmailNotifyOutcome.skipped("Outbound email is disabled (app.email.enabled=false).");
        }
        String baseUrl = properties.getInternalBaseUrl() == null ? "" : properties.getInternalBaseUrl().trim();
        if (baseUrl.isEmpty()) {
            log.warn("Email is enabled but app.email.internal-base-url is empty; skipping.");
            return AppointmentEmailNotifyOutcome.skipped("internal-base-url is not configured.");
        }
        String portalBase = properties.getPortalBaseUrl() == null ? "" : properties.getPortalBaseUrl().trim();
        if (portalBase.isEmpty()) {
            log.warn("Email portal base URL is empty; skipping.");
            return AppointmentEmailNotifyOutcome.skipped("portal-base-url is not configured.");
        }

        AppointmentCreatedEmailRequest request =
                AppointmentCreatedEmailRequest.from(appointment, doctorEmail, portalBase);

        String secret = properties.getInternalSecret() == null ? "" : properties.getInternalSecret().trim();
        RestClient client = RestClient.create(baseUrl);
        try {
            String responseBody = client.post()
                    .uri("/hospital/appointment-created")
                    .headers(headers -> {
                        if (!secret.isEmpty()) {
                            headers.set("X-Email-Internal-Secret", secret);
                        }
                    })
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .body(String.class);
            if (responseBody == null || responseBody.isBlank()) {
                return AppointmentEmailNotifyOutcome.failed("Empty response from email service");
            }
            return parseEmailServiceResponse(responseBody);
        } catch (RestClientResponseException ex) {
            String errorBody = ex.getResponseBodyAsString();
            String detail = "HTTP " + ex.getStatusCode().value();
            if (errorBody != null && !errorBody.isBlank()) {
                detail = detail + ": " + truncate(errorBody.trim(), MAX_DETAIL - 20);
            } else if (ex.getMessage() != null) {
                detail = detail + ": " + truncate(ex.getMessage(), MAX_DETAIL - 20);
            }
            log.warn("Appointment email HTTP error: {}", detail);
            return AppointmentEmailNotifyOutcome.failed(truncate(detail, MAX_DETAIL));
        } catch (Exception ex) {
            log.warn("Failed to send appointment-created emails: {}", ex.getMessage());
            return AppointmentEmailNotifyOutcome.failed(truncate(ex.getMessage(), MAX_DETAIL));
        }
    }

    private AppointmentEmailNotifyOutcome parseEmailServiceResponse(String rawBody) {
        String body = rawBody == null ? "" : rawBody;
        try {
            JsonNode root = objectMapper.readTree(body.isBlank() ? "{}" : body);
            if (!root.path("ok").asBoolean(false)) {
                String err = root.path("error").asText("Email service returned ok=false");
                return AppointmentEmailNotifyOutcome.failed(truncate(err, MAX_DETAIL));
            }

            JsonNode patient = root.path("patient");
            boolean patientOk = patient.path("success").asBoolean(false);
            String patientErr = textOrEmpty(patient.path("error"));

            boolean hasDoctor = root.hasNonNull("doctor") && root.get("doctor").isObject();
            if (!hasDoctor) {
                if (patientOk) {
                    log.warn("Doctor email was not sent for appointment-created notification (missing/invalid doctor email in payload or resolver).");
                    return AppointmentEmailNotifyOutcome.partial(DOCTOR_EMAIL_FAILED_DETAIL);
                }
                return AppointmentEmailNotifyOutcome.failed(
                        truncate(firstNonBlank(patientErr, "Patient email failed"), MAX_DETAIL));
            }

            JsonNode doctor = root.get("doctor");
            boolean doctorOk = doctor.path("success").asBoolean(false);
            String doctorErr = textOrEmpty(doctor.path("error"));

            if (patientOk && doctorOk) {
                return AppointmentEmailNotifyOutcome.success();
            }
            if (patientOk) {
                return AppointmentEmailNotifyOutcome.partial(
                        truncate(firstNonBlank(doctorErr, "Doctor email failed"), MAX_DETAIL));
            }
            if (doctorOk) {
                return AppointmentEmailNotifyOutcome.partial(
                        truncate(firstNonBlank(patientErr, "Patient email failed"), MAX_DETAIL));
            }
            return AppointmentEmailNotifyOutcome.failed(
                    truncate(joinErrors(patientErr, doctorErr), MAX_DETAIL));
        } catch (Exception ex) {
            return AppointmentEmailNotifyOutcome.failed(
                    truncate("Invalid email service response: " + ex.getMessage(), MAX_DETAIL));
        }
    }

    private static String textOrEmpty(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return "";
        }
        return node.asText("").trim();
    }

    private static String firstNonBlank(String preferred, String fallback) {
        if (preferred != null && !preferred.isBlank()) {
            return preferred;
        }
        return fallback;
    }

    private static String joinErrors(String a, String b) {
        if ((a == null || a.isBlank()) && (b == null || b.isBlank())) {
            return "Patient and doctor emails failed";
        }
        if (a == null || a.isBlank()) {
            return b;
        }
        if (b == null || b.isBlank()) {
            return a;
        }
        return a + "; " + b;
    }

    private static String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        String v = value.trim();
        if (v.length() <= max) {
            return v;
        }
        return v.substring(0, Math.max(0, max - 3)) + "...";
    }
}
