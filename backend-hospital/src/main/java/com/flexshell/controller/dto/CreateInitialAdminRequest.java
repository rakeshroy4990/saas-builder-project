package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public class CreateInitialAdminRequest {
    @JsonAlias({"Email"})
    @Email
    @NotBlank
    private String email;
    @JsonAlias({"Password"})
    @NotBlank
    private String password;
    @JsonAlias({"FirstName"})
    @NotBlank
    private String firstName;
    @JsonAlias({"LastName"})
    @NotBlank
    private String lastName;

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
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
}
