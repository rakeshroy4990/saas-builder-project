package com.flexshell.notification;

import java.util.Map;
import java.util.Objects;

public final class NotificationTemplateResolver {

    private NotificationTemplateResolver() {
    }

    public static String resolveTemplate(String template, Map<String, String> vars) {
        if (template == null) {
            return "";
        }
        String result = template;
        if (vars != null) {
            for (Map.Entry<String, String> entry : vars.entrySet()) {
                String key = entry.getKey();
                String value = Objects.toString(entry.getValue(), "");
                result = result.replace("{" + key + "}", value);
            }
        }
        return result;
    }
}
