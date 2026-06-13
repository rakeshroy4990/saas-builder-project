package com.flexshell.growth;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Component
@ConditionalOnProperty(name = "app.persistence.provider", havingValue = "postgres")
public class WhoDataLoader {

    private final Map<String, WhoLmsTable> tables = new LinkedHashMap<>();

    @PostConstruct
    public void load() {
        loadTable("wfa_male", "who-data/wfa-boys-0-5.csv");
        loadTable("wfa_female", "who-data/wfa-girls-0-5.csv");
        loadTable("lhfa_male", "who-data/lhfa-boys-0-5.csv");
        loadTable("lhfa_female", "who-data/lhfa-girls-0-5.csv");
        loadTable("bfa_male", "who-data/bfa-boys-0-5.csv");
        loadTable("bfa_female", "who-data/bfa-girls-0-5.csv");
        loadTable("hcfa_male", "who-data/hcfa-boys-0-5.csv");
        loadTable("hcfa_female", "who-data/hcfa-girls-0-5.csv");
    }

    public WhoLmsTable table(WhoGrowthMetric metric, String sex) {
        String key = metric.wireKey() + "_" + normalizeSex(sex);
        WhoLmsTable table = tables.get(key);
        if (table == null) {
            throw new IllegalArgumentException("WHO_TABLE_NOT_FOUND");
        }
        return table;
    }

    private void loadTable(String key, String classpathLocation) {
        try {
            ClassPathResource resource = new ClassPathResource(classpathLocation);
            List<WhoLmsRow> rows = new ArrayList<>();
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(resource.getInputStream(), StandardCharsets.UTF_8))) {
                String line = reader.readLine();
                while ((line = reader.readLine()) != null) {
                    String trimmed = line.trim();
                    if (trimmed.isEmpty()) {
                        continue;
                    }
                    String[] parts = trimmed.split(",");
                    if (parts.length < 4) {
                        continue;
                    }
                    rows.add(new WhoLmsRow(
                            Double.parseDouble(parts[0].trim()),
                            Double.parseDouble(parts[1].trim()),
                            Double.parseDouble(parts[2].trim()),
                            Double.parseDouble(parts[3].trim())
                    ));
                }
            }
            tables.put(key, new WhoLmsTable(rows));
        } catch (Exception ex) {
            throw new IllegalStateException("WHO_DATA_LOAD_FAILED:" + key, ex);
        }
    }

    private static String normalizeSex(String sex) {
        String normalized = sex == null ? "" : sex.trim().toLowerCase(Locale.ROOT);
        if ("male".equals(normalized) || "m".equals(normalized) || "boy".equals(normalized)) {
            return "male";
        }
        if ("female".equals(normalized) || "f".equals(normalized) || "girl".equals(normalized)) {
            return "female";
        }
        throw new IllegalArgumentException("WHO_SEX_INVALID");
    }
}
