package com.flexshell.doctorschedule;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@Document(collection = "doctorSchedule")
public class DoctorScheduleEntity {
    @Id
    private String id;

    @Indexed(unique = true)
    @Field("DoctorId")
    private String doctorId = "";

    @Field("Weekly")
    private Map<String, DoctorScheduleDay> weekly = new LinkedHashMap<>();

    @Field("UpdatedBy")
    private String updatedBy = "";

    @Field("UpdatedAt")
    private Instant updatedAt;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getDoctorId() {
        return doctorId;
    }

    public void setDoctorId(String doctorId) {
        this.doctorId = doctorId == null ? "" : doctorId.trim();
    }

    public Map<String, DoctorScheduleDay> getWeekly() {
        return weekly;
    }

    public void setWeekly(Map<String, DoctorScheduleDay> weekly) {
        this.weekly = weekly == null ? new LinkedHashMap<>() : weekly;
    }

    public String getUpdatedBy() {
        return updatedBy;
    }

    public void setUpdatedBy(String updatedBy) {
        this.updatedBy = updatedBy == null ? "" : updatedBy.trim();
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
