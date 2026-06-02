package com.flexshell.uimetadata.api;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Merges an incoming {@link UiMetadataSaveRequest} into a stored document so partial saves
 * (e.g. only {@code dynamicConfig}) do not wipe {@code packages} or {@code staticConfig}.
 */
public final class UiMetadataDocumentMerge {

    private UiMetadataDocumentMerge() {
    }

    public static UiMetadataSaveRequest merge(Optional<UiMetadataGetResponse> stored, UiMetadataSaveRequest incoming) {
        UiMetadataGetResponse base = stored.orElseGet(UiMetadataGetResponse::new);
        UiMetadataSaveRequest out = new UiMetadataSaveRequest();

        String version = incoming.getVersion();
        if (version == null || version.isBlank()) {
            version = base.getVersion();
        }
        out.setVersion(version != null && !version.isBlank() ? version : "1.0");

        if (incoming.getPackages() != null && !incoming.getPackages().isEmpty()) {
            out.setPackages(incoming.getPackages());
        } else if (base.getPackages() != null) {
            out.setPackages(base.getPackages());
        } else {
            out.setPackages(new ArrayList<>());
        }

        out.setStaticConfig(deepMergeMaps(base.getStaticConfig(), incoming.getStaticConfig()));
        out.setDynamicConfig(deepMergeMaps(base.getDynamicConfig(), incoming.getDynamicConfig()));
        out.setI18nBundles(mergeI18nBundles(base.getI18nBundles(), incoming.getI18nBundles()));
        return out;
    }

    private static Map<String, Map<String, Object>> mergeI18nBundles(
            Map<String, Map<String, Object>> base,
            Map<String, Map<String, Object>> patch
    ) {
        if (patch == null || patch.isEmpty()) {
            return copyI18nBundles(base);
        }
        Map<String, Map<String, Object>> result = copyI18nBundles(base);
        for (Map.Entry<String, Map<String, Object>> entry : patch.entrySet()) {
            String locale = entry.getKey();
            Map<String, Object> patchMessages = entry.getValue();
            if (patchMessages == null || patchMessages.isEmpty()) {
                continue;
            }
            Map<String, Object> merged = deepMergeMaps(result.get(locale), patchMessages);
            result.put(locale, merged);
        }
        return result;
    }

    private static Map<String, Map<String, Object>> copyI18nBundles(Map<String, Map<String, Object>> source) {
        Map<String, Map<String, Object>> copy = new LinkedHashMap<>();
        if (source == null) {
            return copy;
        }
        for (Map.Entry<String, Map<String, Object>> entry : source.entrySet()) {
            Map<String, Object> localeMap = entry.getValue();
            copy.put(entry.getKey(), localeMap != null ? deepMergeMaps(localeMap, Map.of()) : new LinkedHashMap<>());
        }
        return copy;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> deepMergeMaps(Map<String, Object> base, Map<String, Object> patch) {
        if (patch == null || patch.isEmpty()) {
            return base != null ? new LinkedHashMap<>(base) : new LinkedHashMap<>();
        }
        Map<String, Object> result = base != null ? new LinkedHashMap<>(base) : new LinkedHashMap<>();
        for (Map.Entry<String, Object> entry : patch.entrySet()) {
            String key = entry.getKey();
            Object patchValue = entry.getValue();
            Object baseValue = result.get(key);
            if (patchValue instanceof Map<?, ?> patchMap && baseValue instanceof Map<?, ?> baseMap) {
                result.put(key, deepMergeMaps((Map<String, Object>) baseMap, (Map<String, Object>) patchMap));
            } else if (patchValue instanceof List<?>) {
                result.put(key, patchValue);
            } else {
                result.put(key, patchValue);
            }
        }
        return result;
    }
}
