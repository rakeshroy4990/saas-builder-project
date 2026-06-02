package com.flexshell.uimetadata;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flexshell.uimetadata.api.UiMetadataGetResponse;
import com.flexshell.uimetadata.api.UiMetadataJsonMapper;
import com.flexshell.uimetadata.api.UiMetadataSaveRequest;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class UiMetadataJsonMapperTest {

  private final ObjectMapper objectMapper = new ObjectMapper();

  @Test
  void roundTripsI18nBundlesWithFlatKeys() throws Exception {
    UiMetadataSaveRequest doc = new UiMetadataSaveRequest();
    doc.setVersion("2026-06-02-demo");
    Map<String, Map<String, Object>> bundles = new LinkedHashMap<>();
    Map<String, Object> hi = new LinkedHashMap<>();
    hi.put("hospital.brandTitle", "सनराइज पीडियाट्रिक्स");
    bundles.put("hi", hi);
    doc.setI18nBundles(bundles);

    String json = UiMetadataJsonMapper.toJson(objectMapper, doc);
    UiMetadataGetResponse loaded = UiMetadataJsonMapper.fromJson(objectMapper, json);

    assertFalse(loaded.getI18nBundles().isEmpty());
    assertEquals("सनराइज पीडियाट्रिक्स", loaded.getI18nBundles().get("hi").get("hospital.brandTitle"));
  }
}
