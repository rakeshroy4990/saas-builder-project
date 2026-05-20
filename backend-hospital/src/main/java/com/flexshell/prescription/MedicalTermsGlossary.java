package com.flexshell.prescription;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Loads {@code prescription/medical-terms-glossary.json} and corrects common OCR/vision misreads
 * (e.g. WALFI → WALRI) in clinical text fields.
 */
@Component
public class MedicalTermsGlossary {

    private static final Logger LOG = LoggerFactory.getLogger(MedicalTermsGlossary.class);
    private static final String RESOURCE = "prescription/medical-terms-glossary.json";

    private final ObjectMapper objectMapper;
    private final boolean enabled;

    private List<ReplacementRule> phraseRules = List.of();
    private List<ReplacementRule> tokenRules = List.of();
    private List<PatternRule> patternRules = List.of();

    public MedicalTermsGlossary(
            ObjectMapper objectMapper,
            @Value("${app.prescription.medical-glossary.enabled:true}") boolean enabled
    ) {
        this.objectMapper = objectMapper;
        this.enabled = enabled;
    }

    @PostConstruct
    void loadGlossary() {
        if (!enabled) {
            phraseRules = List.of();
            tokenRules = List.of();
            patternRules = List.of();
            LOG.info("medical_glossary_disabled");
            return;
        }
        try (InputStream in = new ClassPathResource(RESOURCE).getInputStream()) {
            JsonNode root = objectMapper.readTree(in);
            JsonNode terms = root.path("terms");
            Map<String, String> aliasToCanonical = new LinkedHashMap<>();
            if (terms.isArray()) {
                for (JsonNode term : terms) {
                    String canonical = Objects.toString(term.path("canonical").asText(""), "").trim();
                    if (canonical.isBlank()) {
                        continue;
                    }
                    registerAlias(aliasToCanonical, canonical, canonical);
                    JsonNode aliases = term.path("aliases");
                    if (aliases.isArray()) {
                        for (JsonNode aliasNode : aliases) {
                            registerAlias(aliasToCanonical, aliasNode.asText(""), canonical);
                        }
                    }
                }
            }
            List<ReplacementRule> built = new ArrayList<>();
            for (Map.Entry<String, String> entry : aliasToCanonical.entrySet()) {
                String alias = entry.getKey();
                String canonical = entry.getValue();
                if (alias.equalsIgnoreCase(canonical)) {
                    continue;
                }
                built.add(new ReplacementRule(alias, canonical, buildWordPattern(alias), false));
            }
            List<ReplacementRule> phraseRules = new ArrayList<>();
            JsonNode phraseNodes = root.path("phrases");
            if (phraseNodes.isArray()) {
                for (JsonNode phrase : phraseNodes) {
                    String canonical = Objects.toString(phrase.path("canonical").asText(""), "").trim();
                    if (canonical.isBlank()) {
                        continue;
                    }
                    registerPhraseRule(phraseRules, canonical, canonical);
                    JsonNode aliases = phrase.path("aliases");
                    if (aliases.isArray()) {
                        for (JsonNode aliasNode : aliases) {
                            registerPhraseRule(phraseRules, aliasNode.asText(""), canonical);
                        }
                    }
                }
            }
            phraseRules.sort(Comparator.comparingInt((ReplacementRule r) -> r.alias().length()).reversed());
            this.phraseRules = List.copyOf(phraseRules);

            built.sort(Comparator.comparingInt((ReplacementRule r) -> r.alias().length()).reversed());
            this.tokenRules = List.copyOf(built);

            List<PatternRule> patterns = new ArrayList<>();
            JsonNode patternNodes = root.path("patterns");
            if (patternNodes.isArray()) {
                for (JsonNode node : patternNodes) {
                    String canonical = Objects.toString(node.path("canonical").asText(""), "").trim();
                    String regex = Objects.toString(node.path("regex").asText(""), "").trim();
                    if (canonical.isBlank() || regex.isBlank()) {
                        continue;
                    }
                    patterns.add(new PatternRule(canonical, Pattern.compile(regex, Pattern.CASE_INSENSITIVE)));
                }
            }
            this.patternRules = List.copyOf(patterns);

            LOG.info(
                    "medical_glossary_loaded phrases={} tokens={} patterns={}",
                    phraseRules.size(),
                    tokenRules.size(),
                    patternRules.size()
            );
        } catch (Exception ex) {
            phraseRules = List.of();
            tokenRules = List.of();
            patternRules = List.of();
            LOG.warn("medical_glossary_load_failed ex={}", ex.getClass().getSimpleName());
        }
    }

    public boolean isEnabled() {
        return enabled && (!phraseRules.isEmpty() || !tokenRules.isEmpty() || !patternRules.isEmpty());
    }

    /**
     * Applies glossary replacements to clinical free text (diagnosis, medications, notes).
     */
    public String normalizeClinicalText(String text) {
        if (!isEnabled() || text == null || text.isBlank()) {
            return Objects.toString(text, "").trim();
        }
        String normalized = text;
        int replacements = 0;
        ApplyResult phraseResult = applyRules(normalized, phraseRules);
        normalized = phraseResult.text();
        replacements += phraseResult.replacements();
        ApplyResult patternResult = applyPatternRules(normalized);
        normalized = patternResult.text();
        replacements += patternResult.replacements();
        ApplyResult tokenResult = applyRules(normalized, tokenRules);
        normalized = tokenResult.text();
        replacements += tokenResult.replacements();
        if (replacements > 0) {
            LOG.debug("medical_glossary_applied replacements={}", replacements);
        }
        return normalized.trim();
    }

    private static ApplyResult applyRules(String input, List<ReplacementRule> rules) {
        String normalized = input;
        int replacements = 0;
        for (ReplacementRule rule : rules) {
            Matcher matcher = rule.pattern().matcher(normalized);
            StringBuffer sb = new StringBuffer();
            boolean changed = false;
            while (matcher.find()) {
                String replacement = rule.useExactCanonicalCase()
                        ? rule.canonical()
                        : preserveCase(matcher.group(), rule.canonical());
                matcher.appendReplacement(sb, Matcher.quoteReplacement(replacement));
                changed = true;
                replacements++;
            }
            if (changed) {
                matcher.appendTail(sb);
                normalized = sb.toString();
            }
        }
        return new ApplyResult(normalized, replacements);
    }

    private ApplyResult applyPatternRules(String input) {
        String normalized = input;
        int replacements = 0;
        for (PatternRule patternRule : patternRules) {
            Matcher matcher = patternRule.pattern().matcher(normalized);
            StringBuffer sb = new StringBuffer();
            boolean changed = false;
            while (matcher.find()) {
                matcher.appendReplacement(
                        sb,
                        Matcher.quoteReplacement(preserveCase(matcher.group(), patternRule.canonical()))
                );
                changed = true;
                replacements++;
            }
            if (changed) {
                matcher.appendTail(sb);
                normalized = sb.toString();
            }
        }
        return new ApplyResult(normalized, replacements);
    }

    private record ApplyResult(String text, int replacements) {
    }

    private static void registerAlias(Map<String, String> map, String alias, String canonical) {
        String key = normalizeAliasKey(alias);
        if (!key.isBlank() && !map.containsKey(key)) {
            map.put(key, canonical.trim());
        }
    }

    private static void registerPhraseRule(List<ReplacementRule> rules, String alias, String canonical) {
        String trimmedAlias = Objects.toString(alias, "").trim();
        String trimmedCanonical = canonical.trim();
        if (trimmedAlias.isBlank() || trimmedCanonical.isBlank()) {
            return;
        }
        if (trimmedAlias.equalsIgnoreCase(trimmedCanonical)) {
            return;
        }
        rules.add(new ReplacementRule(trimmedAlias, trimmedCanonical, buildPhrasePattern(trimmedAlias), true));
    }

    /** Phrase aliases may include spaces and punctuation; match as literal substring (case-insensitive). */
    private static Pattern buildPhrasePattern(String alias) {
        return Pattern.compile(Pattern.quote(alias.trim()), Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    }

    private static String normalizeAliasKey(String alias) {
        return Objects.toString(alias, "").trim().toUpperCase(Locale.ROOT);
    }

    private static Pattern buildWordPattern(String alias) {
        String escaped = Pattern.quote(alias.trim());
        return Pattern.compile("(?i)(?<![A-Za-z0-9])" + escaped + "(?![A-Za-z0-9])");
    }

    /** Keep ALL CAPS or Title Case from matched token when canonical is mixed case. */
    private static String preserveCase(String matched, String canonical) {
        if (matched.equals(matched.toUpperCase(Locale.ROOT))) {
            return canonical.toUpperCase(Locale.ROOT);
        }
        if (Character.isUpperCase(matched.charAt(0)) && matched.substring(1).equals(matched.substring(1).toLowerCase(Locale.ROOT))) {
            if (canonical.length() == 1) {
                return canonical.toUpperCase(Locale.ROOT);
            }
            return canonical.substring(0, 1).toUpperCase(Locale.ROOT) + canonical.substring(1).toLowerCase(Locale.ROOT);
        }
        return canonical;
    }

    private record PatternRule(String canonical, Pattern pattern) {
    }

    private record ReplacementRule(String alias, String canonical, Pattern pattern, boolean useExactCanonicalCase) {
    }
}
