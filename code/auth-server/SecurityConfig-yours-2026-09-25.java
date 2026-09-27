// Your own Auth Server SecurityConfig, as you shared it on 25 Sep 2026
// (chat: "JWT validation and internal working"). Kept here as the record of what you wrote.
// Imports omitted in the original paste.

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
        return new InMemoryUserDetailsManager(nithin);

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

        return new InMemoryRegisteredClientRepository(paymentClient);


    }
    @Bean
    public JWKSource<SecurityContext>  jwkSource(){
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
}
