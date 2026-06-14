package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public class ChildProfileSaveRequest {

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
}
