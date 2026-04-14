package com.example.flexshell.uimetadata.api;

import java.util.ArrayList;
import java.util.List;

public class UiMetadataGetResponse {
    private String version = "1.0";
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
