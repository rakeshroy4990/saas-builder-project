package com.flexshell.controller;

import com.flexshell.service.LogService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class LogControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private LogService logService;

    @Test
    void batchIngestAcceptsLogs() throws Exception {
        when(logService.ingestClientLogs(any())).thenReturn(2);

        String body = """
                {
                  "traceId":"t-1",
                  "entries":[
                    {"level":"INFO","message":"ok","timestamp":"2026-01-01T00:00:00Z","traceId":"t-1","context":{}},
                    {"level":"WARN","message":"retry","timestamp":"2026-01-01T00:01:00Z","traceId":"t-1","context":{}}
                  ]
                }
                """;

        mockMvc.perform(post("/api/logs/batch")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accepted").value(2));

        verify(logService).ingestClientLogs(any());
    }

    @Test
    void levelEndpointChangesServerLevel() throws Exception {
        when(logService.setServerLogLevel("DEBUG")).thenReturn("DEBUG");

        mockMvc.perform(post("/api/logs/level")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"level\":\"DEBUG\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.level").value("DEBUG"));
    }
}
