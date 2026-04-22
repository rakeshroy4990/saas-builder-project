package com.flexshell.auth.api;

import com.fasterxml.jackson.annotation.JsonProperty;

public class RegisterResponse {
    @JsonProperty("UserId")
    private String userId;

    @JsonProperty("EmailId")
    private String emailId;

    @JsonProperty("FirstName")
    private String firstName;

    @JsonProperty("LastName")
    private String lastName;

    @JsonProperty("Password")
    private String password;

    @JsonProperty("Address")
    private String address;

    @JsonProperty("Gender")
    private String gender;

    @JsonProperty("MobileNumber")
    private String mobileNumber;

    @JsonProperty("Department")
    private String department;

    @JsonProperty("Qualifications")
    private String qualifications;

    @JsonProperty("SmcName")
    private String smcName;

    @JsonProperty("SmcRegistrationNumber")
    private String smcRegistrationNumber;

    @JsonProperty("CreatedTimestamp")
    private String createdTimestamp;

    @JsonProperty("UpdatedTimestamp")
    private String updatedTimestamp;

    @JsonProperty("Role")
    private String role;

    @JsonProperty("RoleStatus")
    private String roleStatus;

    @JsonProperty("RequestedRole")
    private String requestedRole;

    @JsonProperty("RoleRejectedReason")
    private String roleRejectedReason;

    public RegisterResponse() {
    }

    public RegisterResponse(
            String userId,
            String emailId,
            String firstName,
            String lastName,
            String password,
            String address,
            String gender,
            String mobileNumber,
            String department,
            String qualifications,
            String smcName,
            String smcRegistrationNumber,
            String createdTimestamp,
            String updatedTimestamp,
            String role,
            String roleStatus,
            String requestedRole,
            String roleRejectedReason) {
        this.userId = userId;
        this.emailId = emailId;
        this.firstName = firstName;
        this.lastName = lastName;
        this.password = password;
        this.address = address;
        this.gender = gender;
        this.mobileNumber = mobileNumber;
        this.department = department;
        this.qualifications = qualifications;
        this.smcName = smcName;
        this.smcRegistrationNumber = smcRegistrationNumber;
        this.createdTimestamp = createdTimestamp;
        this.updatedTimestamp = updatedTimestamp;
        this.role = role;
        this.roleStatus = roleStatus;
        this.requestedRole = requestedRole;
        this.roleRejectedReason = roleRejectedReason;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getEmailId() {
        return emailId;
    }

    public void setEmailId(String emailId) {
        this.emailId = emailId;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getFirstName() {
        return firstName;
    }

    public void setFirstName(String firstName) {
        this.firstName = firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public void setLastName(String lastName) {
        this.lastName = lastName;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public String getGender() {
        return gender;
    }

    public void setGender(String gender) {
        this.gender = gender;
    }

    public String getMobileNumber() {
        return mobileNumber;
    }

    public void setMobileNumber(String mobileNumber) {
        this.mobileNumber = mobileNumber;
    }

    public String getDepartment() {
        return department;
    }

    public void setDepartment(String department) {
        this.department = department;
    }

    public String getQualifications() {
        return qualifications;
    }

    public void setQualifications(String qualifications) {
        this.qualifications = qualifications;
    }

    public String getSmcName() {
        return smcName;
    }

    public void setSmcName(String smcName) {
        this.smcName = smcName;
    }

    public String getSmcRegistrationNumber() {
        return smcRegistrationNumber;
    }

    public void setSmcRegistrationNumber(String smcRegistrationNumber) {
        this.smcRegistrationNumber = smcRegistrationNumber;
    }

    public String getCreatedTimestamp() {
        return createdTimestamp;
    }

    public void setCreatedTimestamp(String createdTimestamp) {
        this.createdTimestamp = createdTimestamp;
    }

    public String getUpdatedTimestamp() {
        return updatedTimestamp;
    }

    public void setUpdatedTimestamp(String updatedTimestamp) {
        this.updatedTimestamp = updatedTimestamp;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public String getRoleStatus() {
        return roleStatus;
    }

    public void setRoleStatus(String roleStatus) {
        this.roleStatus = roleStatus;
    }

    public String getRequestedRole() {
        return requestedRole;
    }

    public void setRequestedRole(String requestedRole) {
        this.requestedRole = requestedRole;
    }

    public String getRoleRejectedReason() {
        return roleRejectedReason;
    }

    public void setRoleRejectedReason(String roleRejectedReason) {
        this.roleRejectedReason = roleRejectedReason;
    }
}
