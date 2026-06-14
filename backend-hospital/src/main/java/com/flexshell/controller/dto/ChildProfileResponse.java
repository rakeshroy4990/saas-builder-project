package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.UUID;

public class ChildProfileResponse {

    @JsonProperty("ExternalId")
    private UUID externalId;

    @JsonProperty("DisplayName")
    private String displayName;

    @JsonProperty("DateOfBirth")
    private LocalDate dateOfBirth;

    @JsonProperty("Sex")
    private String sex;

    @JsonProperty("BloodGroup")
    private String bloodGroup;

    @JsonProperty("MotherHeightCm")
    private BigDecimal motherHeightCm;

    @JsonProperty("FatherHeightCm")
    private BigDecimal fatherHeightCm;

    @JsonProperty("CreatedAt")
    private Instant createdAt;

    @JsonProperty("UpdatedAt")
    private Instant updatedAt;

    public UUID getExternalId() {
        return externalId;
    }

    public void setExternalId(UUID externalId) {
        this.externalId = externalId;
    }

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }

    public LocalDate getDateOfBirth() {
        return dateOfBirth;
    }

    public void setDateOfBirth(LocalDate dateOfBirth) {
        this.dateOfBirth = dateOfBirth;
    }

    public String getSex() {
        return sex;
    }

    public void setSex(String sex) {
        this.sex = sex;
    }

    public String getBloodGroup() {
        return bloodGroup;
    }

    public void setBloodGroup(String bloodGroup) {
        this.bloodGroup = bloodGroup;
    }

    public BigDecimal getMotherHeightCm() {
        return motherHeightCm;
    }

    public void setMotherHeightCm(BigDecimal motherHeightCm) {
        this.motherHeightCm = motherHeightCm;
    }

    public BigDecimal getFatherHeightCm() {
        return fatherHeightCm;
    }

    public void setFatherHeightCm(BigDecimal fatherHeightCm) {
        this.fatherHeightCm = fatherHeightCm;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
