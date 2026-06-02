package com.flexshell.extension;

import java.util.Map;

@FunctionalInterface
public interface ExtensionHook {
    /**
     * Transform payload before/after persistence. Return modified map or throw to abort.
     */
    Map<String, Object> apply(Map<String, Object> data, ExtensionContext context) throws Exception;
}
