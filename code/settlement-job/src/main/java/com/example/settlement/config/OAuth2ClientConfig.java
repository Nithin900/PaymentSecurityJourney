package com.example.settlement.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.client.AuthorizedClientServiceOAuth2AuthorizedClientManager;
import org.springframework.security.oauth2.client.InMemoryOAuth2AuthorizedClientService;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientManager;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientProvider;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientProviderBuilder;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientService;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.client.OAuth2ClientHttpRequestInterceptor;
import org.springframework.web.client.RestClient;

/*
 * How the job gets its token (no user, no request):
 *
 *   RestClient call to Service B
 *        │
 *        ▼
 *   OAuth2ClientHttpRequestInterceptor ── "which client?" → "settlement-job"
 *        │
 *        ▼
 *   AuthorizedClientManager ── token in cache and not expired? ── YES → reuse
 *        │ NO
 *        ▼
 *   POST http://localhost:9000/oauth2/token  (Basic settlement-job:settlement-secret,
 *                                             grant_type=client_credentials)
 *        │
 *        ▼
 *   Authorization: Bearer <JWT>  added to the request to Service B
 */
@Configuration
public class OAuth2ClientConfig {

    public static final String REGISTRATION_ID = "settlement-job";

    // Stores the token between runs (in memory).
    @Bean
    public OAuth2AuthorizedClientService authorizedClientService(ClientRegistrationRepository registrations) {
        return new InMemoryOAuth2AuthorizedClientService(registrations);
    }

    // Use the "AuthorizedClientService" manager, NOT DefaultOAuth2AuthorizedClientManager:
    // the default one needs an HTTP request, and a @Scheduled job has none.
    @Bean
    public OAuth2AuthorizedClientManager authorizedClientManager(ClientRegistrationRepository registrations,
                                                                 OAuth2AuthorizedClientService clientService) {
        OAuth2AuthorizedClientProvider provider = OAuth2AuthorizedClientProviderBuilder.builder()
                .clientCredentials()   // the only grant this app uses
                .build();

        AuthorizedClientServiceOAuth2AuthorizedClientManager manager =
                new AuthorizedClientServiceOAuth2AuthorizedClientManager(registrations, clientService);
        manager.setAuthorizedClientProvider(provider);
        return manager;
    }

    // RestClient for Service B that attaches the job's token to every request.
    @Bean
    public RestClient serviceBRestClient(RestClient.Builder builder,
                                         OAuth2AuthorizedClientManager authorizedClientManager,
                                         @Value("${settlement.service-b-url}") String serviceBUrl) {
        OAuth2ClientHttpRequestInterceptor oauth2 = new OAuth2ClientHttpRequestInterceptor(authorizedClientManager);
        oauth2.setClientRegistrationIdResolver(request -> REGISTRATION_ID);

        return builder
                .baseUrl(serviceBUrl)
                .requestInterceptor(oauth2)
                .build();
    }
}
