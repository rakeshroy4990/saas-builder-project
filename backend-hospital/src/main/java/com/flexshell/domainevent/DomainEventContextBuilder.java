package com.flexshell.domainevent;

import com.fasterxml.jackson.databind.JsonNode;
import com.flexshell.appointment.AppointmentEntity;
import com.flexshell.persistence.postgres.AppointmentEntityMapper;
import com.flexshell.persistence.postgres.model.AppointmentJpaEntity;
import com.flexshell.persistence.postgres.repository.AppointmentJpaRepository;
import com.flexshell.notification.NotificationTriggerSupport;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

@Component
public class DomainEventContextBuilder {

    private final ObjectProvider<AppointmentJpaRepository> appointmentRepositoryProvider;
    private final ObjectProvider<AppointmentEntityMapper> appointmentEntityMapperProvider;

    public DomainEventContextBuilder(
            ObjectProvider<AppointmentJpaRepository> appointmentRepositoryProvider,
            ObjectProvider<AppointmentEntityMapper> appointmentEntityMapperProvider
    ) {
        this.appointmentRepositoryProvider = appointmentRepositoryProvider;
        this.appointmentEntityMapperProvider = appointmentEntityMapperProvider;
    }

    public Map<String, Object> build(String contextProfile, JsonNode dataNode, String requestPath) {
        Map<String, Object> raw = jsonToMap(dataNode);
        Map<String, Object> pathVars = extractPathVariables(requestPath);
        raw.putAll(pathVars);

        String profile = Objects.toString(contextProfile, "GENERIC").trim().toUpperCase(Locale.ROOT);
        return switch (profile) {
            case "APPOINTMENT" -> buildAppointmentContext(raw);
            case "USER" -> buildUserContext(raw);
            default -> raw;
        };
    }

    private Map<String, Object> buildAppointmentContext(Map<String, Object> raw) {
        Map<String, Object> context = new LinkedHashMap<>(raw);
        normalizeKey(context, "id", "appointmentId");
        normalizeKey(context, "appointmentid", "appointmentId");
        normalizeKey(context, "createdby", "patientId");
        normalizeKey(context, "patientname", "patientName");
        normalizeKey(context, "doctorname", "doctorName");
        normalizeKey(context, "doctorid", "doctorId");
        normalizeKey(context, "preferreddate", "preferredDate");
        normalizeKey(context, "preferredtimeslot", "preferredTimeSlot");

        String appointmentId = Objects.toString(context.get("appointmentId"), "").trim();
        if (appointmentId.isBlank()) {
            appointmentId = Objects.toString(context.get("id"), "").trim();
        }
        if (!appointmentId.isBlank()) {
            enrichFromAppointmentEntity(appointmentId, context);
        }

        if (!context.containsKey("date")) {
            String date = Objects.toString(context.get("preferredDate"), "").trim();
            String slot = Objects.toString(context.get("preferredTimeSlot"), "").trim();
            if (!date.isBlank() && !slot.isBlank()) {
                context.put("date", date + " " + slot);
            } else if (!date.isBlank()) {
                context.put("date", date);
            } else if (!slot.isBlank()) {
                context.put("date", slot);
            }
        }
        return context;
    }

    private Map<String, Object> buildUserContext(Map<String, Object> raw) {
        Map<String, Object> context = new LinkedHashMap<>(raw);
        normalizeKey(context, "userid", "userId");
        normalizeKey(context, "id", "userId");
        normalizeKey(context, "firstname", "firstName");
        normalizeKey(context, "lastname", "lastName");
        normalizeKey(context, "requestedrole", "role");
        String requestedRole = Objects.toString(context.get("requestedRole"), "").trim();
        if (!requestedRole.isBlank()) {
            context.put("role", requestedRole);
        }

        if (!context.containsKey("name")) {
            String first = Objects.toString(context.get("firstName"), "").trim();
            String last = Objects.toString(context.get("lastName"), "").trim();
            String name = (first + " " + last).trim();
            if (!name.isBlank()) {
                context.put("name", name);
            }
        }
        if (!context.containsKey("doctorId") && context.containsKey("userId")) {
            context.put("doctorId", context.get("userId"));
        }
        return context;
    }

    private void enrichFromAppointmentEntity(String appointmentId, Map<String, Object> context) {
        AppointmentJpaRepository repository = appointmentRepositoryProvider.getIfAvailable();
        if (repository == null) {
            return;
        }
        Optional<AppointmentJpaEntity> postgresRow = repository.findById(appointmentId).filter(row -> !row.isDeleted());
        if (postgresRow.isEmpty()) {
            return;
        }
        AppointmentEntityMapper mapper = appointmentEntityMapperProvider.getIfAvailable();
        if (mapper == null) {
            return;
        }
        AppointmentEntity entity = mapper.toDomain(postgresRow.get());
        Map<String, Object> enriched = NotificationTriggerSupport.appointmentContext(entity, postgresRow);
        for (Map.Entry<String, Object> entry : enriched.entrySet()) {
            context.putIfAbsent(entry.getKey(), entry.getValue());
        }
    }

    private static Map<String, Object> jsonToMap(JsonNode dataNode) {
        Map<String, Object> raw = new LinkedHashMap<>();
        if (dataNode == null || !dataNode.isObject()) {
            return raw;
        }
        dataNode.fields().forEachRemaining(entry -> {
            JsonNode value = entry.getValue();
            if (value == null || value.isNull()) {
                raw.put(camelCase(entry.getKey()), "");
            } else if (value.isValueNode()) {
                raw.put(camelCase(entry.getKey()), value.asText(""));
            } else {
                raw.put(camelCase(entry.getKey()), value.toString());
            }
        });
        return raw;
    }

    private static Map<String, Object> extractPathVariables(String requestPath) {
        Map<String, Object> vars = new LinkedHashMap<>();
        String path = Objects.toString(requestPath, "").trim();
        String[] segments = path.split("/");
        for (int i = 0; i < segments.length; i++) {
            String segment = segments[i];
            if (segment.isBlank()) {
                continue;
            }
            if (i > 0 && "appointment".equalsIgnoreCase(segments[i - 1])) {
                vars.putIfAbsent("appointmentId", segment);
            }
            if (i > 0 && "delete".equalsIgnoreCase(segments[i - 1])) {
                vars.putIfAbsent("appointmentId", segment);
            }
            if (i > 0 && "update".equalsIgnoreCase(segments[i - 1])) {
                vars.putIfAbsent("appointmentId", segment);
            }
            if (i > 0 && "cancel".equalsIgnoreCase(segments[i - 1])) {
                vars.putIfAbsent("appointmentId", segment);
            }
            if (i > 0 && "role-requests".equalsIgnoreCase(segments[i - 1])) {
                vars.putIfAbsent("userId", segment);
                vars.putIfAbsent("doctorId", segment);
            }
        }
        return vars;
    }

    private static void normalizeKey(Map<String, Object> context, String from, String to) {
        for (Map.Entry<String, Object> entry : Map.copyOf(context).entrySet()) {
            if (entry.getKey().equalsIgnoreCase(from)) {
                context.putIfAbsent(to, entry.getValue());
            }
        }
    }

    private static String camelCase(String key) {
        if (key == null || key.isBlank()) {
            return "";
        }
        if (!key.contains("_") && Character.isLowerCase(key.charAt(0))) {
            return key;
        }
        StringBuilder builder = new StringBuilder();
        boolean upperNext = false;
        for (char ch : key.toCharArray()) {
            if (ch == '_' || ch == '-') {
                upperNext = true;
                continue;
            }
            if (builder.isEmpty()) {
                builder.append(Character.toLowerCase(ch));
            } else if (upperNext) {
                builder.append(Character.toUpperCase(ch));
                upperNext = false;
            } else {
                builder.append(Character.isUpperCase(ch) ? Character.toLowerCase(ch) : ch);
            }
        }
        return builder.toString();
    }
}
