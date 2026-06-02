package com.flexshell.extension;

import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Facade for services to run L3 hooks without depending on filter details.
 */
public class ExtensionHookInvoker {
    private final HookRegistry hookRegistry;

    public ExtensionHookInvoker(HookRegistry hookRegistry) {
        this.hookRegistry = hookRegistry;
    }

    public static String endpointKey(String method, String servletPath) {
        String m = method == null ? "GET" : method.trim().toUpperCase();
        String p = servletPath == null ? "/" : servletPath;
        if (!p.startsWith("/")) {
            p = "/" + p;
        }
        return m + " " + p;
    }

    public Map<String, Object> runBefore(String endpointKey, Map<String, Object> data, ExtensionContext context) {
        return hookRegistry.runBefore(endpointKey, data, context);
    }

    public Map<String, Object> runAfter(String endpointKey, Map<String, Object> data, ExtensionContext context) {
        return hookRegistry.runAfter(endpointKey, data, context);
    }

    public ExtensionContext contextFromRequest(HttpServletRequest request, String userId, String role) {
        String ip = request.getRemoteAddr();
        String ua = request.getHeader("User-Agent");
        return ExtensionContext.of(userId, role, ip, ua);
    }

    public static Map<String, Object> mapOf(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i + 1 < kv.length; i += 2) {
            m.put(String.valueOf(kv[i]), kv[i + 1]);
        }
        return m;
    }
}
