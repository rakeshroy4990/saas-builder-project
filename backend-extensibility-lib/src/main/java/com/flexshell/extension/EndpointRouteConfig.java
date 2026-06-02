package com.flexshell.extension;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@JsonIgnoreProperties(ignoreUnknown = true)
public class EndpointRouteConfig {
    private String reroute;
    private Map<String, String> headers = new LinkedHashMap<>();
    private HookNames hooks = new HookNames();

    public String getReroute() {
        return reroute;
    }

    public void setReroute(String reroute) {
        this.reroute = reroute;
    }

    public Map<String, String> getHeaders() {
        return headers;
    }

    public void setHeaders(Map<String, String> headers) {
        this.headers = headers != null ? headers : new LinkedHashMap<>();
    }

    public HookNames getHooks() {
        return hooks;
    }

    public void setHooks(HookNames hooks) {
        this.hooks = hooks != null ? hooks : new HookNames();
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class HookNames {
        private List<String> before = new ArrayList<>();
        private List<String> after = new ArrayList<>();

        public List<String> getBefore() {
            return before;
        }

        public void setBefore(List<String> before) {
            this.before = before != null ? before : new ArrayList<>();
        }

        public List<String> getAfter() {
            return after;
        }

        public void setAfter(List<String> after) {
            this.after = after != null ? after : new ArrayList<>();
        }
    }
}
