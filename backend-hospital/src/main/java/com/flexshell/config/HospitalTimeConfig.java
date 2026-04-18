package com.flexshell.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.ZoneId;

@Configuration
public class HospitalTimeConfig {
    @Bean(name = "hospitalZoneId")
    public ZoneId hospitalZoneId(@Value("${app.hospital.time-zone:UTC}") String timeZoneId) {
        return ZoneId.of(timeZoneId.trim());
    }
}
