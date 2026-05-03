package com.flexshell.persistence.postgres;

import com.flexshell.appointment.AppointmentEntity;
import com.flexshell.persistence.postgres.model.AppointmentJpaEntity;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
public class AppointmentEntityMapper {

    private static final String STATUS_DELETED = "DELETED";

    public AppointmentEntity toDomain(AppointmentJpaEntity row) {
        if (row == null) {
            return null;
        }
        AppointmentEntity e = new AppointmentEntity();
        e.setId(row.getId());
        e.setPatientName(row.getPatientName());
        e.setEmail(row.getEmail());
        e.setPhoneNumber(row.getPhoneNumber());
        e.setAgeGroup(row.getAgeGroup());
        e.setDepartment(row.getDepartment());
        e.setDoctorId(row.getDoctorId());
        e.setDoctorName(row.getDoctorName());
        e.setPreferredDate(row.getPreferredDate());
        e.setPreferredTimeSlot(row.getPreferredTimeSlot());
        e.setAdditionalNotes(row.getAdditionalNotes());
        e.setStatus(row.getStatus());
        e.setPrescriptionFiles(filesFromJson(row.getPrescriptionFiles()));
        e.setCreatedTimestamp(row.getCreatedTimestamp());
        e.setUpdatedTimestamp(row.getUpdatedTimestamp());
        e.setCreatedBy(row.getCreatedBy());
        e.setUpdatedBy(row.getUpdatedBy());
        e.setAppointmentEmailNotifyStatus(row.getAppointmentEmailNotifyStatus());
        e.setAppointmentEmailNotifyFailed(row.getAppointmentEmailNotifyFailed());
        e.setAppointmentEmailNotifyDetail(row.getAppointmentEmailNotifyDetail());
        e.setAppointmentEmailNotifyAt(row.getAppointmentEmailNotifyAt());
        e.setCallStatus(row.getCallStatus());
        e.setCallStartTime(row.getCallStartTime());
        e.setCallEndTime(row.getCallEndTime());
        if (row.isDeleted()) {
            e.setStatus(STATUS_DELETED);
        }
        return e;
    }

    public AppointmentJpaEntity toJpa(AppointmentEntity e, AppointmentJpaEntity existing) {
        AppointmentJpaEntity row = existing != null ? existing : new AppointmentJpaEntity();
        row.setId(e.getId());
        if (row.getExternalId() == null) {
            row.setExternalId(UUID.randomUUID());
        }
        row.setPatientName(e.getPatientName());
        row.setEmail(e.getEmail());
        row.setPhoneNumber(e.getPhoneNumber());
        row.setAgeGroup(e.getAgeGroup());
        row.setDepartment(e.getDepartment());
        row.setDoctorId(e.getDoctorId());
        row.setDoctorName(e.getDoctorName());
        row.setPreferredDate(e.getPreferredDate());
        row.setPreferredTimeSlot(e.getPreferredTimeSlot());
        row.setAdditionalNotes(e.getAdditionalNotes());
        row.setStatus(e.getStatus());
        row.setPrescriptionFiles(filesToJson(e.getPrescriptionFiles()));
        row.setCreatedTimestamp(e.getCreatedTimestamp());
        row.setUpdatedTimestamp(e.getUpdatedTimestamp());
        row.setCreatedBy(e.getCreatedBy());
        row.setUpdatedBy(e.getUpdatedBy());
        row.setAppointmentEmailNotifyStatus(e.getAppointmentEmailNotifyStatus());
        row.setAppointmentEmailNotifyFailed(e.getAppointmentEmailNotifyFailed());
        row.setAppointmentEmailNotifyDetail(e.getAppointmentEmailNotifyDetail());
        row.setAppointmentEmailNotifyAt(e.getAppointmentEmailNotifyAt());
        row.setCallStatus(e.getCallStatus());
        row.setCallStartTime(e.getCallStartTime());
        row.setCallEndTime(e.getCallEndTime());
        boolean softDeleted = STATUS_DELETED.equalsIgnoreCase(e.getStatus() == null ? "" : e.getStatus().trim());
        row.setDeleted(softDeleted);
        return row;
    }

    private List<AppointmentEntity.AppointmentFile> filesFromJson(List<Map<String, Object>> raw) {
        if (raw == null || raw.isEmpty()) {
            return new ArrayList<>();
        }
        List<AppointmentEntity.AppointmentFile> out = new ArrayList<>();
        for (Map<String, Object> m : raw) {
            if (m == null) {
                continue;
            }
            AppointmentEntity.AppointmentFile f = new AppointmentEntity.AppointmentFile();
            f.setFileId(str(first(m, "FileId", "fileId")));
            f.setFileName(str(first(m, "FileName", "fileName")));
            f.setContentType(str(first(m, "ContentType", "contentType")));
            Object sz = first(m, "Size", "size");
            if (sz instanceof Number n) {
                f.setSize(n.longValue());
            }
            Object data = first(m, "Data", "data");
            if (data instanceof byte[] b) {
                f.setData(b);
            } else if (data instanceof String s && !s.isBlank()) {
                try {
                    f.setData(Base64.getDecoder().decode(s));
                } catch (IllegalArgumentException ignored) {
                    f.setData(null);
                }
            }
            out.add(f);
        }
        return out;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> filesToJson(List<AppointmentEntity.AppointmentFile> files) {
        if (files == null || files.isEmpty()) {
            return new ArrayList<>();
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (AppointmentEntity.AppointmentFile f : files) {
            if (f == null) {
                continue;
            }
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("FileId", f.getFileId());
            m.put("FileName", f.getFileName());
            m.put("ContentType", f.getContentType());
            m.put("Size", f.getSize());
            if (f.getData() != null && f.getData().length > 0) {
                m.put("Data", Base64.getEncoder().encodeToString(f.getData()));
            }
            out.add(m);
        }
        return out;
    }

    private static Object first(Map<String, Object> m, String... keys) {
        for (String k : keys) {
            if (m.containsKey(k) && m.get(k) != null) {
                return m.get(k);
            }
        }
        return null;
    }

    private static String str(Object o) {
        return o == null ? null : String.valueOf(o);
    }
}
