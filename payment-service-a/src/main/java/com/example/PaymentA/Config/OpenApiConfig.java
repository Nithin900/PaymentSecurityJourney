package com.example.PaymentA.Config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Swagger UI at http://localhost:8080/swagger-ui.html
 * Every endpoint needs a Bearer JWT from the auth server: get one, click Authorize, paste only the token.
 */
@Configuration
public class OpenApiConfig {

    private static final String BEARER = "bearerAuth";

    @Bean
    public OpenAPI paymentOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("Payment Service A (gateway)")
                        .version("v1")
                        .description("""
                                Every call needs a Bearer JWT from the auth server (scopes: payment.read to read, payment.write to create).

                                **Get a token:** open
                                `http://localhost:9000/oauth2/authorize?response_type=code&client_id=payment-client&scope=payment.read%20payment.write&redirect_uri=https://oauth.pstmn.io/v1/callback`,
                                log in as `nithin` / `password`, then exchange the `code=` value (`scripts\send-test-payment.ps1` does this),
                                click **Authorize** and paste the access token (without the word Bearer).
                                Payments are owned by the user in the token: another user gets 404 for them."""))
                .addServersItem(new Server().url("http://localhost:8080").description("Local"))
                .components(new Components().addSecuritySchemes(BEARER, new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP)
                        .scheme("bearer")
                        .bearerFormat("JWT")
                        .description("Access token from http://localhost:9000/oauth2/token")))
                .addSecurityItem(new SecurityRequirement().addList(BEARER));   // applies to every operation
    }
}
