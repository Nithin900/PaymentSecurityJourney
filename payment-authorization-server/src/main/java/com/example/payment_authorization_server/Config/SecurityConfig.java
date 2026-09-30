package com.example.payment_authorization_server.Config;

import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import com.nimbusds.jose.jwk.source.JWKSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import com.nimbusds.jose.proc.SecurityContext;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.server.authorization.client.InMemoryRegisteredClientRepository;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.security.oauth2.server.authorization.config.annotation.web.configuration.OAuth2AuthorizationServerConfiguration;
import org.springframework.security.oauth2.server.authorization.config.annotation.web.configurers.OAuth2AuthorizationServerConfigurer;
import org.springframework.security.oauth2.server.authorization.settings.AuthorizationServerSettings;
import org.springframework.security.oauth2.server.authorization.settings.ClientSettings;
import org.springframework.security.oauth2.server.authorization.settings.TokenSettings;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.LoginUrlAuthenticationEntryPoint;
import org.springframework.security.web.util.matcher.MediaTypeRequestMatcher;
import org.springframework.core.io.Resource;
import java.io.InputStream;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.time.Duration;
import java.util.UUID;

@Configuration
@EnableWebSecurity
public class SecurityConfig {
    @Bean
    @Order(1)
    public SecurityFilterChain authorizationServerSecurityFilterChain(HttpSecurity http) throws Exception {
        OAuth2AuthorizationServerConfigurer authorizationServerConfigurer=new OAuth2AuthorizationServerConfigurer();

        http.securityMatcher(authorizationServerConfigurer.getEndpointsMatcher())
                .with(authorizationServerConfigurer,authorizationServer -> authorizationServer.oidc(Customizer.withDefaults()))
                .authorizeHttpRequests(authorize -> authorize.anyRequest().authenticated())
                .exceptionHandling(exceptions -> exceptions.defaultAuthenticationEntryPointFor(new LoginUrlAuthenticationEntryPoint("/login"),new MediaTypeRequestMatcher(MediaType.TEXT_HTML))


                );
        return http.build();
    }
    @Bean
    @Order(2)
    public SecurityFilterChain defaultSecurityFilterChain(HttpSecurity http) throws Exception {
        http.authorizeHttpRequests(authorize -> authorize .anyRequest().authenticated())
                .formLogin(Customizer.withDefaults());
        return http.build();

    }
    @Bean
    public UserDetailsService userDetailsService()
    {
        UserDetails nithin= User.withDefaultPasswordEncoder()
                .username("nithin")
                .password("password")
                .roles("USER")
                .build();
        UserDetails alice= User.withDefaultPasswordEncoder()
                .username("alice")
                .password("password")
                .roles("USER")
                .build();
        return new InMemoryUserDetailsManager(nithin, alice);

    }

    @Bean
    public RegisteredClientRepository registeredClientRepository()
    {
        RegisteredClient paymentClient= RegisteredClient.withId(UUID.randomUUID().toString())
                .clientId("payment-client")
                .clientSecret("{noop}secret")
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .redirectUri("https://oauth.pstmn.io/v1/callback")
                .scope("payment.read")
                .scope("payment.write")
                .clientSettings(ClientSettings.builder().requireAuthorizationConsent(true).build())
                .tokenSettings(TokenSettings.builder().accessTokenTimeToLive(Duration.ofMinutes(5))
                        .build()
                ).build();
        // Machine-to-machine: service B calls the notification service with its own token
        RegisteredClient serviceBClient = RegisteredClient.withId(UUID.randomUUID().toString())
                .clientId("payment-service-b")
                .clientSecret("{noop}b-secret")
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                .authorizationGrantType(AuthorizationGrantType.CLIENT_CREDENTIALS)
                .scope("notification.send")
                .tokenSettings(TokenSettings.builder().accessTokenTimeToLive(Duration.ofMinutes(5)).build())
                .build();
        return new InMemoryRegisteredClientRepository(paymentClient,serviceBClient);


    }
    // Dev only: in-memory RSA key regenerated on every startup (tokens die on restart). No keystore file needed.
    // Active only with --spring.profiles.active=dev; every other profile uses the keystore-backed jwkSource below.
    @Bean
    @Profile("dev")
    public JWKSource<SecurityContext> devJwkSource(){
        KeyPair keyPair = generateRsaKey();

        RSAKey  rsaKey=new RSAKey.Builder((RSAPublicKey) keyPair.getPublic()).privateKey((RSAPrivateKey) keyPair.getPrivate())
                .keyID(UUID.randomUUID().toString()).build();

        return new ImmutableJWKSet<>(new JWKSet(rsaKey));
    }

    private static KeyPair generateRsaKey() {
        try {
            KeyPairGenerator keyPairGenerator = KeyPairGenerator.getInstance("RSA");
            keyPairGenerator.initialize(2048);
            return keyPairGenerator.generateKeyPair();
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }
    @Bean
    public JwtDecoder jwtDecoder(JWKSource<SecurityContext> jwkSource) {
        return OAuth2AuthorizationServerConfiguration.jwtDecoder(jwkSource);
    }

    @Bean
    public AuthorizationServerSettings authorizationServerSettings(){
        return AuthorizationServerSettings.builder().issuer("http://localhost:9000").build();
    }
    // Non-dev: signing key loaded from a PKCS12 keystore (needs KEYSTORE_PATH and KEYSTORE_PASSWORD).
    @Bean
    @Profile("!dev")
    public JWKSource<SecurityContext> jwkSource(@Value("${KEYSTORE_PATH}") Resource file,        // e.g. file:/secure/securepay.p12
                                               @Value("${KEYSTORE_PASSWORD}") String pw) throws Exception {
        KeyStore ks = KeyStore.getInstance("PKCS12");
        try (InputStream in = file.getInputStream()) {
            ks.load(in, pw.toCharArray());
        }
        RSAKey key = new RSAKey.Builder(RSAKey.load(ks, "securepay", pw.toCharArray()))
                .keyID("securepay-1").build();
        return new ImmutableJWKSet<>(new JWKSet(key));
    }

}