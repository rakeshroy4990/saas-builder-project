package com.flexshell.auth.api;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;

public class RegisterRequest {
    @JsonAlias({"FirstName"})
    @NotBlank(message = "FirstName is required")
    private String firstName;

    @JsonAlias({"LastName"})
    @NotBlank(message = "LastName is required")
    private String lastName;

    @JsonAlias({"EmailId"})
    @NotBlank(message = "EmailId is required")
    private String emailId;

    @JsonAlias({"Password"})
    @NotBlank(message = "Password is required")
    private String password;

    @JsonAlias({"Address"})
    @NotBlank(message = "Address is required")
    private String address;

    @JsonAlias({"Gender"})
    @NotBlank(message = "Gender is required")
    private String gender;

    @JsonAlias({"MobileNumber"})
    @NotBlank(message = "MobileNumber is required")
    private String mobileNumber;

    @JsonAlias({"Department"})
    private String department;

    @JsonAlias({"Role", "RequestedRole"})
    private String role;

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

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public String getDepartment() {
        return department;
    }

    public void setDepartment(String department) {
        this.department = department;
    }
}
