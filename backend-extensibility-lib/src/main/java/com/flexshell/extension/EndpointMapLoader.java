package com.flexshell.extension;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;

/**
 * Loads endpoint_map.json from classpath or configurable filesystem path.
 */
public class EndpointMapLoader {
    private static final Logger LOG = LoggerFactory.getLogger(EndpointMapLoader.class);
    private static final String CLASSPATH_RESOURCE = "extension/endpoint_map.json";

    private final ObjectMapper objectMapper;
    private final Path externalPath;

    public EndpointMapLoader(ObjectMapper objectMapper, Path externalPath) {
        this.objectMapper = objectMapper;
        this.externalPath = externalPath;
    }

    public EndpointMapDocument load() throws IOException {
        if (externalPath != null && Files.isRegularFile(externalPath)) {
            LOG.info("[EndpointMap] Loading from {}", externalPath);
            return objectMapper.readValue(Files.readString(externalPath), EndpointMapDocument.class);
        }
        try (InputStream in = getClass().getClassLoader().getResourceAsStream(CLASSPATH_RESOURCE)) {
            if (in == null) {
                LOG.warn("[EndpointMap] No {} on classpath; using empty map", CLASSPATH_RESOURCE);
                return new EndpointMapDocument();
            }
            return objectMapper.readValue(in, EndpointMapDocument.class);
        }
    }
}
