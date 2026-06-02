package com.flexshell.uimetadata.api;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.LinkedHashMap;
import java.util.Map;

/** JSON round-trip for UI metadata documents stored in {@code body_json}. */
public final class UiMetadataJsonMapper {

    private static final TypeReference<Map<String, Map<String, Object>>> I18N_BUNDLES_TYPE =
            new TypeReference<>() {};

    private UiMetadataJsonMapper() {
    }

    public static String toJson(ObjectMapper objectMapper, UiMetadataSaveRequest document)
            throws JsonProcessingException {
        JsonNode tree = objectMapper.valueToTree(document);
        return objectMapper.writeValueAsString(tree);
    }

    public static UiMetadataGetResponse fromJson(ObjectMapper objectMapper, String json)
            throws JsonProcessingException {
        JsonNode root = objectMapper.readTree(json);
        UiMetadataGetResponse doc = objectMapper.treeToValue(root, UiMetadataGetResponse.class);
        if (doc == null) {
            doc = new UiMetadataGetResponse();
        }
        JsonNode bundlesNode = root.get("i18nBundles");
        if (bundlesNode != null && !bundlesNode.isNull() && bundlesNode.isObject()) {
            Map<String, Map<String, Object>> bundles =
                    objectMapper.convertValue(bundlesNode, I18N_BUNDLES_TYPE);
            if (bundles != null && !bundles.isEmpty()) {
                doc.setI18nBundles(bundles);
            }
        }
        return doc;
    }
}
