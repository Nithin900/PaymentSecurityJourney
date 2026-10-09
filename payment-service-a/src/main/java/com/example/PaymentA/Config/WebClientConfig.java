package com.example.PaymentA.Config;

import io.netty.channel.ChannelOption;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.server.resource.web.reactive.function.client.ServletBearerExchangeFilterFunction;
import org.springframework.web.reactive.function.client.WebClient;

import reactor.netty.http.client.HttpClient;
import java.time.Duration;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;



@Configuration
public class WebClientConfig {

    @Bean
    public WebClient webClient(WebClient.Builder builder) {
        HttpClient http = HttpClient.create()                         // reactor.netty.http.client
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 2000)
                .responseTimeout(Duration.ofSeconds(3));
        return builder
                .baseUrl("http://localhost:8081")
                .clientConnector(new ReactorClientHttpConnector(http))
                .filter(new ServletBearerExchangeFilterFunction())
                .build();
    }

}
