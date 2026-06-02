package com.flexshell.extension;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.LinkedHashMap;
import java.util.Map;

@JsonIgnoreProperties(ignoreUnknown = true)
public class EndpointMapDocument {
    private String tenantId;
    private Map<String, EndpointRouteConfig> routes = new LinkedHashMap<>();

    public String getTenantId() {
        return tenantId;
    }

    public void setTenantId(String tenantId) {
        this.tenantId = tenantId;
    }

    public Map<String, EndpointRouteConfig> getRoutes() {
        return routes;
    }

    public void setRoutes(Map<String, EndpointRouteConfig> routes) {
        this.routes = routes != null ? routes : new LinkedHashMap<>();
    }
}
