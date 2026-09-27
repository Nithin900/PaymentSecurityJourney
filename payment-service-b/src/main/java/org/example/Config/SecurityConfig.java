package org.example.Config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
public class SecurityConfig {
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
            http
                    .authorizeHttpRequests(auth -> auth .requestMatchers("/actuator/health").permitAll()
                    .requestMatchers("/h2-console/**").permitAll()
                    .requestMatchers("/error").permitAll()
                    .requestMatchers(HttpMethod.POST,"/payments/**").hasAuthority("SCOPE_payment.write")
                    .requestMatchers(HttpMethod.GET,"/payments/**").hasAuthority("SCOPE_payment.read")
                    .anyRequest().authenticated())
        .oauth2ResourceServer(oauth2  -> oauth2.jwt(Customizer.withDefaults()))
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
         .csrf(csrf -> csrf.disable())
                // Lets the H2 console render in the browser
                .headers(h -> h.frameOptions(f -> f.sameOrigin()));
        return http.build();


    }

}
