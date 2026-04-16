package com.flexshell.uimetadata.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.ArrayList;
import java.util.List;

public class UiMetadataSaveRequest {
    @NotBlank(message = "version is required")
    private String version = "1.0";
    @NotNull(message = "packages must be provided")
    @Valid
    private List<UiMetadataPackageDto> packages = new ArrayList<>();

    public String getVersion() {
        return version;
    }

    public void setVersion(String version) {
        this.version = version;
    }

    public List<UiMetadataPackageDto> getPackages() {
        return packages;
    }

    public void setPackages(List<UiMetadataPackageDto> packages) {
        this.packages = packages;
    }
}
