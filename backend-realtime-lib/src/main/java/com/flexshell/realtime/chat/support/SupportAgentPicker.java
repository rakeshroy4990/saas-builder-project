package com.flexshell.realtime.chat.support;

import java.util.List;

/**
 * Resolves online support agents (e.g. admins) for support chat routing.
 * App modules should provide an implementation.
 */
public interface SupportAgentPicker {
    List<String> listOnlineAgentUserIds();
}

