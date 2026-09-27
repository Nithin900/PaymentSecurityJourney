// ---------- NODES: id, label, class, x, y, w, group, what it is ----------
var NODES = [
 // client
 ["client","Client","browser / Postman / service",20,45,120,"io","Whoever sends the HTTP request: a browser, Postman, or another service."],
 ["response","HTTP Response","status + headers",20,120,120,"io","What goes back to the client: status code, headers (Set-Cookie, Location, WWW-Authenticate, security headers) and body."],
 // entry
 ["dfp","DelegatingFilterProxy","servlet filter bean bridge",160,45,150,"entry","A plain servlet Filter registered in Tomcat. It knows nothing about security; it looks up the Spring bean 'springSecurityFilterChain' and hands the request to it."],
 ["fcp","FilterChainProxy","picks one SecurityFilterChain",160,90,150,"entry","The Spring bean behind DelegatingFilterProxy. Loops your SecurityFilterChain beans and uses the FIRST whose matcher matches the request (@Order decides the order)."],
 ["fw","HttpFirewall","StrictHttpFirewall",160,135,150,"entry","Wraps the request and rejects dangerous URLs (encoded slashes, ';', '..', non-printable characters) with RequestRejectedException."],
 // filters (order = real default order, trimmed)
 ["f_ctx","SecurityContextHolderFilter","loads context",340,45,200,"filter","Loads the SecurityContext (lazily) from the SecurityContextRepository and puts it on the thread; clears it in a finally block. Since 6.0 it does NOT save it."],
 ["f_hdr","HeaderWriterFilter","security headers",340,75,200,"filter","Adds security response headers (Cache-Control, X-Content-Type-Options, X-Frame-Options, HSTS on HTTPS...). Configured with http.headers()."],
 ["f_cors","CorsFilter","cross-origin rules",340,105,200,"filter","Applies your CorsConfigurationSource. Answers preflight OPTIONS requests itself and adds Access-Control-* headers. Enabled with http.cors()."],
 ["f_csrf","CsrfFilter","CSRF token check",340,135,200,"filter","For state-changing methods (POST, PUT, DELETE...) compares the submitted CSRF token with the stored one; mismatch → 403. Disabled for stateless Bearer APIs."],
 ["f_logout","LogoutFilter","POST /logout",340,165,200,"filter","On the logout URL runs the LogoutHandlers (invalidate session, clear context, remove CSRF token) and then the LogoutSuccessHandler."],
 ["f_upaf","UsernamePasswordAuthenticationFilter","form login",340,195,200,"filter","On POST /login reads username/password parameters, builds an unauthenticated token and asks the AuthenticationManager. Added by formLogin()."],
 ["f_basic","BasicAuthenticationFilter","Authorization: Basic",340,225,200,"filter","Reads 'Authorization: Basic base64(user:pass)' on any request and authenticates it. Added by httpBasic()."],
 ["f_bearer","BearerTokenAuthenticationFilter","Authorization: Bearer",340,255,200,"filter","Reads the Bearer token, authenticates it through the AuthenticationManager (JWT or opaque). Added by oauth2ResourceServer()."],
 ["f_reqcache","RequestCacheAwareFilter","replays saved request",340,285,200,"filter","If this request matches one saved before login, swaps in the saved request so the original parameters are available."],
 ["f_anon","AnonymousAuthenticationFilter","anonymous user",340,315,200,"filter","If nobody authenticated yet, puts an AnonymousAuthenticationToken (principal 'anonymousUser', ROLE_ANONYMOUS) in the context so later code never sees null."],
 ["f_etf","ExceptionTranslationFilter","401 / 403 decisions",340,345,200,"filter","Catches AuthenticationException and AccessDeniedException thrown further down. Anonymous or not authenticated → AuthenticationEntryPoint (401 / redirect to login). Authenticated but denied → AccessDeniedHandler (403)."],
 ["f_authz","AuthorizationFilter","URL rules",340,375,200,"filter","Last filter. Asks the AuthorizationManager whether the current Authentication may access this URL (authorizeHttpRequests rules). No → AccessDeniedException."],
 // storage
 ["holder","SecurityContextHolder","ThreadLocal",160,225,150,"store","Static holder of the current SecurityContext → Authentication (principal, authorities). ThreadLocal by default: new threads (@Async) don't inherit it unless you propagate it."],
 ["repo","SecurityContextRepository","save / load context",160,270,150,"store","Where the context lives between requests. HttpSessionSecurityContextRepository (form login) or RequestAttributeSecurityContextRepository (stateless APIs)."],
 ["session","HttpSession","JSESSIONID",160,315,150,"store","Server-side session identified by the JSESSIONID cookie. Holds SPRING_SECURITY_CONTEXT, the CSRF token and the saved request."],
 ["reqstore","RequestCache","HttpSessionRequestCache",160,360,150,"store","Stores the request that was interrupted by login (SPRING_SECURITY_SAVED_REQUEST) so the user returns to it afterwards."],
 // authentication
 ["mgr","AuthenticationManager","ProviderManager",580,45,230,"authn","Single entry point for 'please verify this'. ProviderManager loops its AuthenticationProviders and uses the first whose supports() matches the token type. Erases credentials on success."],
 ["p_dao","DaoAuthenticationProvider","username + password",580,85,230,"authn","Loads the user with UserDetailsService, checks account status, compares the password with PasswordEncoder, returns an authenticated UsernamePasswordAuthenticationToken."],
 ["p_jwt","JwtAuthenticationProvider","Bearer JWT",580,125,230,"authn","Decodes and validates the JWT with JwtDecoder, converts claims to authorities with JwtAuthenticationConverter, returns JwtAuthenticationToken."],
 ["p_client","ClientSecretAuthenticationProvider","OAuth2 client (Auth Server)",580,165,230,"authn","On the Authorization Server: authenticates the CLIENT application (client_id + secret) against RegisteredClientRepository using the PasswordEncoder."],
 ["p_codereq","OAuth2AuthorizationCodeRequest…","/oauth2/authorize",580,205,230,"authn","Validates an authorization request: known client, exact redirect_uri, allowed scopes, PKCE parameters, logged-in user, consent."],
 ["p_code","OAuth2AuthorizationCode…Provider","code → token",580,245,230,"authn","Exchanges an authorization code for tokens: finds the code, checks it's unused, unexpired, same client and redirect_uri, then generates the access token."],
 ["p_cc","OAuth2ClientCredentials…Provider","client_credentials",580,285,230,"authn","Issues a token to an authenticated client for the client_credentials grant: checks the grant is allowed and scopes are registered."],
 ["p_refresh","OAuth2RefreshToken…Provider","refresh_token",580,325,230,"authn","Exchanges a refresh token for a new access token: finds the authorization, checks it's active and belongs to the client, checks scopes."],
 // support
 ["enc","PasswordEncoder","DelegatingPasswordEncoder",850,45,300,"support","Hashes and matches passwords. DelegatingPasswordEncoder reads the {id} prefix ({bcrypt}, {noop}...) and delegates to the right encoder."],
 ["uds","UserDetailsService","load user by username",850,85,300,"support","loadUserByUsername(name) → UserDetails (username, hashed password, authorities, account flags). InMemoryUserDetailsManager, JdbcUserDetailsManager or your own JPA version."],
 ["db","Database","users, authorities",850,125,300,"support","Where users live. JdbcUserDetailsManager queries 'users' and 'authorities' tables by default."],
 ["decoder","JwtDecoder","NimbusJwtDecoder",850,165,300,"support","Parses the JWT, picks the key by kid, verifies the signature, runs validators (exp/nbf with 60 s skew, iss, optional aud)."],
 ["jwks","JWK Set (public keys)","Auth Server /oauth2/jwks",850,205,300,"support","Public keys published by the Authorization Server. Resource servers fetch them once via issuer-uri discovery and cache them."],
 ["rcr","RegisteredClientRepository","clients + grants + scopes",850,245,300,"support","On the Authorization Server: the list of registered client applications with their secret, grant types, redirect URIs, scopes and token settings."],
 ["authsvc","OAuth2AuthorizationService","codes and tokens issued",850,285,300,"support","On the Authorization Server: stores OAuth2Authorization records (authorization codes, access and refresh tokens, state) so later requests can find and invalidate them."],
 ["consent","OAuth2AuthorizationConsentService","who approved which scopes",850,325,300,"support","Remembers which scopes a user already approved for a client, so the consent screen isn't shown again."],
 ["gen","JwtGenerator + JWKSource","signs access tokens",850,365,300,"support","Builds the JWT claims (iss, sub, aud, scope, iat, exp, jti) and signs them with the private key from JWKSource (kid in the header)."],
 // authorization + errors
 ["azmgr","AuthorizationManager","URL / method rules",580,405,230,"authz","Decides allow/deny for a request or method from the Authentication's authorities, e.g. hasAuthority('SCOPE_payment.write'), authenticated(), hasRole('ADMIN')."],
 ["entry","AuthenticationEntryPoint","start authentication",580,445,230,"authz","What to do when authentication is needed: LoginUrlAuthenticationEntryPoint (302 /login), BasicAuthenticationEntryPoint (401 Basic), BearerTokenAuthenticationEntryPoint (401 Bearer)."],
 ["denied","AccessDeniedHandler","403",580,485,230,"authz","What to do when an authenticated user is not allowed: AccessDeniedHandlerImpl (403) or BearerTokenAccessDeniedHandler (403 + WWW-Authenticate insufficient_scope)."],
 // auth server endpoint filters
 ["as_authz","OAuth2AuthorizationEndpointFilter","/oauth2/authorize",850,425,300,"as","Authorization Server filter that handles /oauth2/authorize: validates the request, shows consent, issues the authorization code."],
 ["as_client","OAuth2ClientAuthenticationFilter","client auth at /token",850,465,300,"as","Authorization Server filter that authenticates the client application on /oauth2/token (Basic header, POST body, private_key_jwt, or PKCE for public clients)."],
 ["as_token","OAuth2TokenEndpointFilter","/oauth2/token",850,505,300,"as","Authorization Server filter that handles /oauth2/token: picks the grant converter (authorization_code, client_credentials, refresh_token) and returns the token JSON."],
 // app layer
 ["ds","DispatcherServlet","→ controller",20,580,160,"app","Spring MVC front controller. Only reached if every security filter let the request through."],
 ["ctrl","Controller","your @RestController",200,580,160,"app","Your code. Can read the user with @AuthenticationPrincipal or SecurityContextHolder."],
 ["msec","@PreAuthorize check","method security",380,580,160,"app","AuthorizationManagerBeforeMethodInterceptor evaluates @PreAuthorize before the method runs (enabled by @EnableMethodSecurity). Denied → AccessDeniedException."],
 ["wc","WebClient (Service A)","ServletBearerExchange…",20,625,160,"app","Service A's HTTP client. ServletBearerExchangeFilterFunction copies the current request's Bearer token onto outgoing calls (token relay)."],
 ["svcb","Service B","validates again",200,625,160,"app","The downstream resource server. It runs its own security filter chain and validates the relayed token independently."],
 ["logouth","LogoutHandlers","session, context, CSRF",380,625,160,"app","SecurityContextLogoutHandler (invalidate session, clear context), CsrfLogoutHandler, LogoutSuccessEventPublishingLogoutHandler; then the LogoutSuccessHandler redirects."],
];
var GROUPS = [
 ["Client",10,22,140,150],["Entry",150,22,170,160],["SecurityFilterChain (default order)",330,22,220,385],["Context storage",150,202,170,196],
 ["Authentication",570,22,250,340],["Supporting services",840,22,320,380],["Authorization & errors",570,382,250,140],["Authorization Server endpoints",840,402,320,140],
 ["Application",10,557,540,105]
];
