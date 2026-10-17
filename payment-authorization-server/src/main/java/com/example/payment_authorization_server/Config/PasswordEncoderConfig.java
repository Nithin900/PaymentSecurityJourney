// INSTRUCTIONS (no code yet)
// Purpose: single place that defines the PasswordEncoder bean.
// 1. Add `package com.example.payment_authorization_server.Config;`
// 2. Mark as @Configuration.
// 3. Expose one @Bean PasswordEncoder using BCrypt (or the delegating encoder
//    via PasswordEncoderFactories.createDelegatingPasswordEncoder()).
// 4. Reuse this bean in UserRegistrationService AND in the authentication provider
//    so hashing and verification always match.
