package com.flexshell.perf;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.flexshell.service.LogService;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {"perf.enabled=false"})
@AutoConfigureMockMvc
class PerfLoggingFilterDisabledTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private LogService logService;

    private ListAppender<ILoggingEvent> perfAppender;
    private Logger perfLogger;

    @BeforeEach
    void attachPerfAppender() {
        perfLogger = (Logger) LoggerFactory.getLogger("PERF");
        perfAppender = new ListAppender<>();
        perfAppender.start();
        perfLogger.addAppender(perfAppender);
    }

    @AfterEach
    void detachPerfAppender() {
        if (perfLogger != null && perfAppender != null) {
            perfLogger.detachAppender(perfAppender);
            perfAppender.stop();
        }
    }

    @Test
    void doesNotEmitPerfLoggerLines() throws Exception {
        when(logService.setServerLogLevel("DEBUG")).thenReturn("DEBUG");

        mockMvc.perform(post("/api/logs/level")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"level\":\"DEBUG\"}"))
                .andExpect(status().isOk());

        List<ILoggingEvent> events = perfAppender.list;
        assertThat(events).isEmpty();
    }
}
