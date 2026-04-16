package com.flexshell.realtime.config;

import com.flexshell.realtime.ws.TrackingWebSocketHandlerDecoratorFactory;
import com.flexshell.realtime.ws.auth.AuthCookieHandshakeInterceptor;
import com.flexshell.realtime.ws.auth.StompAuthChannelInterceptor;
import com.flexshell.realtime.webrtc.ws.WebRtcSessionBindingInterceptor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketTransportRegistration;

@Configuration
@EnableWebSocketMessageBroker
public class RealtimeWebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Value("${app.cors.allowed-origin-patterns:http://localhost:*,https://localhost:*}")
    private String allowedOriginPatterns;

    @Value("${app.ws.relay.enabled:true}")
    private boolean brokerRelayEnabled;

    @Value("${app.ws.relay.host:}")
    private String brokerRelayHost;

    @Value("${app.ws.relay.port:61613}")
    private int brokerRelayPort;

    @Value("${app.ws.relay.client-login:}")
    private String brokerRelayClientLogin;

    @Value("${app.ws.relay.client-passcode:}")
    private String brokerRelayClientPasscode;

    @Value("${app.ws.relay.system-login:}")
    private String brokerRelaySystemLogin;

    @Value("${app.ws.relay.system-passcode:}")
    private String brokerRelaySystemPasscode;

    private final TrackingWebSocketHandlerDecoratorFactory trackingDecoratorFactory;
    private final StompAuthChannelInterceptor stompAuthChannelInterceptor;
    private final WebRtcSessionBindingInterceptor webRtcSessionBindingInterceptor;
    private final AuthCookieHandshakeInterceptor authCookieHandshakeInterceptor;

    public RealtimeWebSocketConfig(
            TrackingWebSocketHandlerDecoratorFactory trackingDecoratorFactory,
            StompAuthChannelInterceptor stompAuthChannelInterceptor,
            WebRtcSessionBindingInterceptor webRtcSessionBindingInterceptor,
            AuthCookieHandshakeInterceptor authCookieHandshakeInterceptor
    ) {
        this.trackingDecoratorFactory = trackingDecoratorFactory;
        this.stompAuthChannelInterceptor = stompAuthChannelInterceptor;
        this.webRtcSessionBindingInterceptor = webRtcSessionBindingInterceptor;
        this.authCookieHandshakeInterceptor = authCookieHandshakeInterceptor;
    }

    private String[] parsePatterns(String raw) {
        return raw == null ? new String[0] : raw.split("\\s*,\\s*");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry
                .addEndpoint("/ws")
                .addInterceptors(authCookieHandshakeInterceptor)
                .setAllowedOriginPatterns(parsePatterns(allowedOriginPatterns));
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");

        boolean relayConfigured = brokerRelayEnabled && brokerRelayHost != null && !brokerRelayHost.trim().isEmpty();
        if (relayConfigured) {
            registry.enableStompBrokerRelay("/topic", "/queue")
                    .setRelayHost(brokerRelayHost.trim())
                    .setRelayPort(brokerRelayPort)
                    .setClientLogin(brokerRelayClientLogin)
                    .setClientPasscode(brokerRelayClientPasscode)
                    .setSystemLogin(brokerRelaySystemLogin)
                    .setSystemPasscode(brokerRelaySystemPasscode);
            return;
        }

        registry.enableSimpleBroker("/topic", "/queue");
    }

    @Override
    public void configureWebSocketTransport(WebSocketTransportRegistration registry) {
        registry.addDecoratorFactory(trackingDecoratorFactory);
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(stompAuthChannelInterceptor);
        registration.interceptors(webRtcSessionBindingInterceptor);
    }
}

