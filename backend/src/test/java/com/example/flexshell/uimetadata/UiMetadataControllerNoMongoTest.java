package com.example.flexshell.uimetadata;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Verifies graceful behavior when MongoDB is not configured.
 */
@SpringBootTest
@AutoConfigureMockMvc
class UiMetadataControllerNoMongoTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void getReturnsEmptyPackagesWhenMongoNotConfigured() throws Exception {
        mockMvc.perform(get("/api/ui-metadata"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value("1.0"))
                .andExpect(jsonPath("$.packages").isArray())
                .andExpect(jsonPath("$.packages").isEmpty());
    }

    @Test
    void postReturnsServiceUnavailableWhenMongoNotConfigured() throws Exception {
        mockMvc.perform(post("/api/ui-metadata")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":\"1.0\",\"packages\":[]}"))
                .andExpect(status().isServiceUnavailable());
    }

    @Test
    void deleteReturnsServiceUnavailableWhenMongoNotConfigured() throws Exception {
        mockMvc.perform(delete("/api/ui-metadata"))
                .andExpect(status().isServiceUnavailable());
    }
}
