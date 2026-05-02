package com.flexshell.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flexshell.ai.OpenAiChatAdapter;
import com.flexshell.controller.dto.BlogPreviewDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(MockitoExtension.class)
class BlogPreviewServiceParseTest {

    @Mock
    private OpenAiChatAdapter openAiChatAdapter;

    private BlogPreviewService service;

    @BeforeEach
    void setUp() {
        service = new BlogPreviewService(openAiChatAdapter, new ObjectMapper(), 0.01);
    }

    @Test
    void parseJsonArray_plainArray() {
        String json = """
                [{"title":"A","slug":"a","teaser":"T","category":"C","readTimeMinutes":4}]
                """;
        List<BlogPreviewDto> out = service.parseJsonArray(json);
        assertThat(out).hasSize(1);
        assertThat(out.get(0).getTitle()).isEqualTo("A");
        assertThat(out.get(0).getReadTimeMinutes()).isEqualTo(4);
    }

    @Test
    void parseJsonArray_stripsMarkdownFence() {
        String json = """
                ```json
                [{"title":"B","slug":"b","teaser":"Hello","category":"X","readTimeMinutes":5}]
                ```
                """;
        List<BlogPreviewDto> out = service.parseJsonArray(json);
        assertThat(out).hasSize(1);
        assertThat(out.get(0).getSlug()).isEqualTo("b");
    }

    @Test
    void parseJsonArray_invalid_returnsEmpty() {
        assertThat(service.parseJsonArray("not json")).isEmpty();
    }
}
