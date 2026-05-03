package com.flexshell.persistence.postgres.model;

import com.flexshell.auth.RoleRequestStatus;
import com.flexshell.auth.UserRole;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "users")
public class UserJpaEntity {

    @Id
    @Column(length = 64)
    private String id;

    @Column(name = "external_id", nullable = false, unique = true)
    private UUID externalId;

    private String username;
    private String email;

    @Column(name = "first_name")
    private String firstName;

    @Column(name = "last_name")
    private String lastName;

    @Column(name = "password_hash")
    private String passwordHash;

    private String address;
    private String gender;

    @Column(name = "mobile_number")
    private String mobileNumber;

    private String department;
    private String qualifications;

    @Column(name = "smc_name")
    private String smcName;

    @Column(name = "smc_registration_number")
    private String smcRegistrationNumber;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    private boolean active = true;

    @Column(name = "token_version")
    private long tokenVersion = 1L;

    @Enumerated(EnumType.STRING)
    private UserRole role = UserRole.PATIENT;

    @Enumerated(EnumType.STRING)
    @Column(name = "role_status")
    private RoleRequestStatus roleStatus = RoleRequestStatus.ACTIVE;

    @Enumerated(EnumType.STRING)
    @Column(name = "requested_role")
    private UserRole requestedRole;

    @Column(name = "role_requested_at")
    private Instant roleRequestedAt;

    @Column(name = "role_decision_at")
    private Instant roleDecisionAt;

    @Column(name = "role_decision_by")
    private String roleDecisionBy;

    @Column(name = "role_rejected_reason")
    private String roleRejectedReason;

    private boolean deleted;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public UUID getExternalId() {
        return externalId;
    }

    public void setExternalId(UUID externalId) {
        this.externalId = externalId;
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

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
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

    public boolean isDeleted() {
        return deleted;
    }

    public void setDeleted(boolean deleted) {
        this.deleted = deleted;
    }
}
