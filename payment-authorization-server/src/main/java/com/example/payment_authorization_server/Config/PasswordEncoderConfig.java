package com.example.payment_authorization_server.Config;
// INSTRUCTIONS (no code yet)
// Purpose: single place that defines the PasswordEncoder bean.
// 1. Add `package com.example.payment_authorization_server.Config;`
// 2. Mark as @Configuration.
// 3. Expose one @Bean PasswordEncoder using BCrypt (or the delegating encoder
//    via PasswordEncoderFactories.createDelegatingPasswordEncoder()).
// 4. Reuse this bean in UserRegistrationService AND in the authentication provider
//    so hashing and verification always match.

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class PasswordEncoderConfig {
    @Bean
    public PasswordEncoder passwordEncoder() {
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }
}