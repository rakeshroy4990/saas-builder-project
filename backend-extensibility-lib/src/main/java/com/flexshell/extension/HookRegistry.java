package com.flexshell.extension;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

public class HookRegistry {
    private static final Logger LOG = LoggerFactory.getLogger(HookRegistry.class);

    private final Map<String, ExtensionHook> hooks = new ConcurrentHashMap<>();
    private volatile EndpointMapDocument endpointMap = new EndpointMapDocument();
    private final EndpointMapLoader loader;

    public HookRegistry(EndpointMapLoader loader) {
        this.loader = loader;
        reload();
    }

    public void register(String name, ExtensionHook hook) {
        hooks.put(name, hook);
        LOG.debug("[HookRegistry] Registered hook: {}", name);
    }

    public void reload() {
        try {
            endpointMap = loader.load();
            LOG.info("[HookRegistry] Endpoint map reloaded ({} routes)", endpointMap.getRoutes().size());
        } catch (Exception ex) {
            LOG.error("[HookRegistry] Failed to reload endpoint map: {}", ex.getMessage());
        }
    }

    public EndpointMapDocument getEndpointMap() {
        return endpointMap;
    }

    public Map<String, String> registeredHookNames() {
        Map<String, String> out = new LinkedHashMap<>();
        hooks.keySet().stream().sorted().forEach(name -> out.put(name, "registered"));
        return Collections.unmodifiableMap(out);
    }

    public Optional<RerouteTarget> getReroute(String endpointKey) {
        EndpointRouteConfig route = endpointMap.getRoutes().get(endpointKey);
        if (route == null || route.getReroute() == null || route.getReroute().isBlank()) {
            return Optional.empty();
        }
        return Optional.of(new RerouteTarget(route.getReroute(), route.getHeaders()));
    }

    public Map<String, Object> runBefore(String endpointKey, Map<String, Object> data, ExtensionContext context) {
        return runHooks(endpointKey, "before", data, context);
    }

    public Map<String, Object> runAfter(String endpointKey, Map<String, Object> data, ExtensionContext context) {
        return runHooks(endpointKey, "after", data, context);
    }

    private Map<String, Object> runHooks(
            String endpointKey,
            String stage,
            Map<String, Object> data,
            ExtensionContext context
    ) {
        EndpointRouteConfig route = endpointMap.getRoutes().get(endpointKey);
        if (route == null || route.getHooks() == null) {
            return data;
        }
        List<String> names = "before".equals(stage)
                ? route.getHooks().getBefore()
                : route.getHooks().getAfter();
        if (names == null || names.isEmpty()) {
            return data;
        }

        Map<String, Object> current = data != null ? new LinkedHashMap<>(data) : new LinkedHashMap<>();
        for (String name : names) {
            ExtensionHook hook = hooks.get(name);
            if (hook == null) {
                LOG.warn("[HookRegistry] Hook '{}' not registered for {}", name, endpointKey);
                continue;
            }
            try {
                Map<String, Object> next = hook.apply(current, context);
                if (next != null) {
                    current = next;
                }
            } catch (Exception ex) {
                LOG.error("[HookRegistry] Hook '{}' failed on {}: {}", name, endpointKey, ex.getMessage());
                if (context.isStrictMode()) {
                    throw new ExtensionHookException("Hook failed: " + name, ex);
                }
            }
        }
        return current;
    }

    public record RerouteTarget(String url, Map<String, String> headers) {}
}
