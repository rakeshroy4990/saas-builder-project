package com.flexshell.extension;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Enumeration;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * For configured routes with {@code reroute}, proxies the request to an external URL.
 */
public class ExtensionRerouteFilter extends OncePerRequestFilter {
    private static final Logger LOG = LoggerFactory.getLogger(ExtensionRerouteFilter.class);
    private static final List<String> SKIP_HEADERS = List.of("host", "content-length", "transfer-encoding");

    private final HookRegistry hookRegistry;
    private final HttpClient httpClient;

    public ExtensionRerouteFilter(HookRegistry hookRegistry) {
        this.hookRegistry = hookRegistry;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path == null || !path.startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String key = ExtensionHookInvoker.endpointKey(request.getMethod(), request.getRequestURI());
        Optional<HookRegistry.RerouteTarget> reroute = hookRegistry.getReroute(key);
        if (reroute.isEmpty()) {
            filterChain.doFilter(request, response);
            return;
        }

        HookRegistry.RerouteTarget target = reroute.get();
        LOG.info("[ExtensionReroute] {} -> {}", key, target.url());
        proxyRequest(request, response, target);
    }

    private void proxyRequest(
            HttpServletRequest request,
            HttpServletResponse response,
            HookRegistry.RerouteTarget target
    ) throws IOException {
        try {
            byte[] body = request.getInputStream().readAllBytes();
            HttpRequest.Builder builder = HttpRequest.newBuilder()
                    .uri(URI.create(target.url()))
                    .timeout(Duration.ofSeconds(60));

            String method = request.getMethod();
            if (method == null) {
                method = "GET";
            }
            builder.method(method, body.length > 0 ? HttpRequest.BodyPublishers.ofByteArray(body) : HttpRequest.BodyPublishers.noBody());

            Enumeration<String> headerNames = request.getHeaderNames();
            while (headerNames.hasMoreElements()) {
                String name = headerNames.nextElement();
                if (SKIP_HEADERS.contains(name.toLowerCase())) {
                    continue;
                }
                builder.header(name, request.getHeader(name));
            }
            for (Map.Entry<String, String> extra : target.headers().entrySet()) {
                builder.header(extra.getKey(), extra.getValue());
            }

            HttpResponse<InputStream> upstream = httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofInputStream());
            response.setStatus(upstream.statusCode());
            upstream.headers().map().forEach((name, values) -> {
                if (SKIP_HEADERS.contains(name.toLowerCase())) {
                    return;
                }
                for (String value : values) {
                    response.addHeader(name, value);
                }
            });
            if (!response.containsHeader(HttpHeaders.CONTENT_TYPE) && upstream.headers().firstValue("Content-Type").isPresent()) {
                response.setContentType(upstream.headers().firstValue("Content-Type").get());
            }
            try (InputStream in = upstream.body()) {
                in.transferTo(response.getOutputStream());
            }
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            response.sendError(HttpServletResponse.SC_BAD_GATEWAY, "Reroute interrupted");
        } catch (Exception ex) {
            LOG.warn("[ExtensionReroute] Proxy failed: {}", ex.getMessage());
            response.sendError(HttpServletResponse.SC_BAD_GATEWAY, "Reroute failed");
        }
    }
}
