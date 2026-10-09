package org.example.Config;

import io.netty.channel.ChannelOption;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.security.oauth2.client.AuthorizedClientServiceOAuth2AuthorizedClientManager;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientService;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.reactive.function.client.ServletOAuth2AuthorizedClientExchangeFilterFunction;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;

import java.time.Duration;

@Configuration
public class NotificationClientConfig {

    @Bean
    public WebClient notificationWebClient(ClientRegistrationRepository registrations,
                                           OAuth2AuthorizedClientService clientService,
                                           WebClient.Builder builder,   // Boot's builder carries the trace id; WebClient.builder() does not
                                           @Value("${notification.base-url}") String baseUrl) {
        // Service-based manager: works outside a user's login session (client_credentials has no user)
        var manager = new AuthorizedClientServiceOAuth2AuthorizedClientManager(registrations, clientService);
        var oauth = new ServletOAuth2AuthorizedClientExchangeFilterFunction(manager);
        oauth.setDefaultClientRegistrationId("notification");

        HttpClient http = HttpClient.create()
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 2000)
                .responseTimeout(Duration.ofSeconds(45));   // SMTP (Gmail) can take 10-30 s; runs off the request thread, see NotificationListener

        return builder
                .baseUrl(baseUrl)
                .clientConnector(new ReactorClientHttpConnector(http))
                .apply(oauth.oauth2Configuration())
                .build();
    }
}