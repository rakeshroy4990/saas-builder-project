package com.flexshell.audio.pipeline;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Component
public class ConsultationProcessorRegistry {

    private final List<ConsultationProcessor> processors;

    public ConsultationProcessorRegistry(List<ConsultationProcessor> processors) {
        this.processors = processors == null ? List.of() : List.copyOf(processors);
    }

    public void afterStructuredAnalysis(Map<String, Object> structuredJson, Map<String, Object> context) {
        for (ConsultationProcessor processor : processors) {
            processor.afterStructuredAnalysis(structuredJson, context);
        }
    }

    public void afterClinicalSummary(Map<String, Object> summaryJson, Map<String, Object> context) {
        for (ConsultationProcessor processor : processors) {
            processor.afterClinicalSummary(summaryJson, context);
        }
    }

    public List<String> registeredIds() {
        List<String> ids = new ArrayList<>();
        for (ConsultationProcessor processor : processors) {
            ids.add(processor.id());
        }
        return ids;
    }
}
