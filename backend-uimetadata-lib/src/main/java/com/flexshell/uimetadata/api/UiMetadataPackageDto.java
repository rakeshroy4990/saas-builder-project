package com.flexshell.uimetadata.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.Map;

public class UiMetadataPackageDto {
    @NotBlank(message = "packageName is required")
    private String packageName;
    @NotNull(message = "pages must be provided")
    private List<Map<String, Object>> pages;

    public String getPackageName() {
        return packageName;
    }

    public void setPackageName(String packageName) {
        this.packageName = packageName;
    }

    public List<Map<String, Object>> getPages() {
        return pages;
    }

    public void setPages(List<Map<String, Object>> pages) {
        this.pages = pages;
    }
}

