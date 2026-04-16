package com.flexshell.auth;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;

@Document(collection = "users")
public class UserEntity {
    @Id
    private String id;
    @Field("Username")
    private String username;
    @Field("Email")
    private String email;
    @Field("FirstName")
    private String firstName;
    @Field("LastName")
    private String lastName;
    @Field("Password")
    private String passwordHash;
    @Field("Address")
    private String address;
    @Field("Gender")
    private String gender;
    @Field("MobileNumber")
    private String mobileNumber;
    @Field("Department")
    private String department;
    @Field("CreatedTimestamp")
    private Instant createdTimestamp;
    @Field("UpdatedTimestamp")
    private Instant updatedTimestamp;
    @Field("Active")
    private boolean active = true;
    @Field("TokenVersion")
    private long tokenVersion = 1L;
    @Field("Role")
    private UserRole role = UserRole.PATIENT;
    @Field("RoleStatus")
    private RoleRequestStatus roleStatus = RoleRequestStatus.ACTIVE;
    @Field("RequestedRole")
    private UserRole requestedRole;
    @Field("RoleRequestedAt")
    private Instant roleRequestedAt;
    @Field("RoleDecisionAt")
    private Instant roleDecisionAt;
    @Field("RoleDecisionBy")
    private String roleDecisionBy;
    @Field("RoleRejectedReason")
    private String roleRejectedReason;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
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

    public Instant getCreatedTimestamp() {
        return createdTimestamp;
    }

    public void setCreatedTimestamp(Instant createdTimestamp) {
        this.createdTimestamp = createdTimestamp;
    }

    public Instant getUpdatedTimestamp() {
        return updatedTimestamp;
    }

    public void setUpdatedTimestamp(Instant updatedTimestamp) {
        this.updatedTimestamp = updatedTimestamp;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public long getTokenVersion() {
        return tokenVersion;
    }

    public void setTokenVersion(long tokenVersion) {
        this.tokenVersion = tokenVersion;
    }

    public UserRole getRole() {
        return role;
    }

    public void setRole(UserRole role) {
        this.role = role;
    }

    public RoleRequestStatus getRoleStatus() {
        return roleStatus;
    }

    public void setRoleStatus(RoleRequestStatus roleStatus) {
        this.roleStatus = roleStatus;
    }

    public UserRole getRequestedRole() {
        return requestedRole;
    }

    public void setRequestedRole(UserRole requestedRole) {
        this.requestedRole = requestedRole;
    }

    public Instant getRoleRequestedAt() {
        return roleRequestedAt;
    }

    public void setRoleRequestedAt(Instant roleRequestedAt) {
        this.roleRequestedAt = roleRequestedAt;
    }

    public Instant getRoleDecisionAt() {
        return roleDecisionAt;
    }

    public void setRoleDecisionAt(Instant roleDecisionAt) {
        this.roleDecisionAt = roleDecisionAt;
    }

    public String getRoleDecisionBy() {
        return roleDecisionBy;
    }

    public void setRoleDecisionBy(String roleDecisionBy) {
        this.roleDecisionBy = roleDecisionBy;
    }

    public String getRoleRejectedReason() {
        return roleRejectedReason;
    }

    public void setRoleRejectedReason(String roleRejectedReason) {
        this.roleRejectedReason = roleRejectedReason;
    }
}

