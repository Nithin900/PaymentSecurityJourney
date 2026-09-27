package com.example.settlement.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;

// This app only makes OUTBOUND calls. Nobody should call into it.
// Declaring our own chain also stops Boot from adding a default oauth2Login setup.
@Configuration
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth.anyRequest().denyAll())
            .csrf(csrf -> csrf.disable());
        return http.build();
    }
}
