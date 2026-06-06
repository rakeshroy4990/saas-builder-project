package com.flexshell.notification;

import com.flexshell.appointment.AppointmentEntity;
import com.flexshell.persistence.postgres.model.AppointmentJpaEntity;
import com.flexshell.persistence.postgres.repository.AppointmentJpaRepository;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

public final class NotificationTriggerSupport {

    private NotificationTriggerSupport() {
    }

    public static void triggerSafely(
            NotificationService notificationService,
            String eventType,
            String actorUserId,
            Map<String, Object> context
    ) {
        if (notificationService == null) {
            return;
        }
        try {
            notificationService.triggerEvent(eventType, actorUserId, context);
        } catch (Exception ex) {
            // Fire-and-forget: notification failure must never fail the primary operation.
        }
    }

    public static Map<String, Object> appointmentContext(
            AppointmentEntity entity,
            Optional<AppointmentJpaEntity> postgresRow
    ) {
        Map<String, Object> context = new LinkedHashMap<>();
        if (entity == null) {
            return context;
        }
        context.put("appointmentId", normalize(entity.getId()));
        context.put("patientId", normalize(entity.getCreatedBy()));
        context.put("doctorId", normalize(entity.getDoctorId()));
        context.put("patientName", normalize(entity.getPatientName()));
        context.put("doctorName", normalize(entity.getDoctorName()));
        context.put("date", formatAppointmentDate(entity));
        postgresRow.map(AppointmentJpaEntity::getExternalId)
                .ifPresent(externalId -> context.put("appointmentExternalId", externalId));
        return context;
    }

    public static Optional<AppointmentJpaEntity> findPostgresAppointment(
            AppointmentJpaRepository appointmentRepository,
            String appointmentId
    ) {
        if (appointmentRepository == null) {
            return Optional.empty();
        }
        String id = normalize(appointmentId);
        if (id.isBlank()) {
            return Optional.empty();
        }
        return appointmentRepository.findById(id).filter(row -> !row.isDeleted());
    }

    private static String formatAppointmentDate(AppointmentEntity entity) {
        String date = normalize(entity.getPreferredDate());
        String slot = normalize(entity.getPreferredTimeSlot());
        if (date.isBlank()) {
            return slot;
        }
        if (slot.isBlank()) {
            return date;
        }
        return date + " " + slot;
    }

    private static String normalize(String value) {
        return Objects.toString(value, "").trim();
    }
}
