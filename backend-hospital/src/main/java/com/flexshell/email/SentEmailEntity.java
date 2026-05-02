package com.flexshell.email;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;

/**
 * Persisted copy of an outbound email (final rendered body) for audit and support.
 * Links the send to a {@link #event} name and optional {@link #patientId} / {@link #doctorId} user ids.
 */
@Document(collection = "sentEmail")
public class SentEmailEntity {

    @Id
    private String id;

    /** Logical event name, e.g. {@code APPOINTMENT_CREATED}, {@code WELCOME}. */
    @Indexed
    @Field("Event")
    private String event;

    /** Final email body (or full text) as sent to the provider. */
    @Field("Email")
    private String email;

    @Indexed
    @Field("PatientId")
    private String patientId;

    @Indexed
    @Field("DoctorId")
    private String doctorId;

    @Field("CreatedTimestamp")
    private Instant createdTimestamp;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getEvent() {
        return event;
    }

    public void setEvent(String event) {
        this.event = event == null ? null : event.trim();
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPatientId() {
        return patientId;
    }

    public void setPatientId(String patientId) {
        this.patientId = patientId == null || patientId.isBlank() ? null : patientId.trim();
    }

    public String getDoctorId() {
        return doctorId;
    }

    public void setDoctorId(String doctorId) {
        this.doctorId = doctorId == null || doctorId.isBlank() ? null : doctorId.trim();
    }

    public Instant getCreatedTimestamp() {
        return createdTimestamp;
    }

    public void setCreatedTimestamp(Instant createdTimestamp) {
        this.createdTimestamp = createdTimestamp;
    }
}
