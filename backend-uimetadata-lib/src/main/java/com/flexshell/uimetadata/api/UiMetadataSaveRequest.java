package com.flexshell.uimetadata.api;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class UiMetadataSaveRequest {
    @NotBlank(message = "version is required")
    private String version = "1.0";
    @NotNull(message = "packages must be provided")
    @Valid
    private List<UiMetadataPackageDto> packages = new ArrayList<>();
    private Map<String, Object> staticConfig = new LinkedHashMap<>();
    private Map<String, Object> dynamicConfig = new LinkedHashMap<>();
    @JsonProperty("i18nBundles")
    private Map<String, Map<String, Object>> i18nBundles = new LinkedHashMap<>();

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

    public Map<String, Object> getStaticConfig() {
        return staticConfig;
    }

    public void setStaticConfig(Map<String, Object> staticConfig) {
        this.staticConfig = staticConfig != null ? staticConfig : new LinkedHashMap<>();
    }

    public Map<String, Object> getDynamicConfig() {
        return dynamicConfig;
    }

    public void setDynamicConfig(Map<String, Object> dynamicConfig) {
        this.dynamicConfig = dynamicConfig != null ? dynamicConfig : new LinkedHashMap<>();
    }

    public Map<String, Map<String, Object>> getI18nBundles() {
        return i18nBundles;
    }

    public void setI18nBundles(Map<String, Map<String, Object>> i18nBundles) {
        this.i18nBundles = i18nBundles != null ? i18nBundles : new LinkedHashMap<>();
    }
}

