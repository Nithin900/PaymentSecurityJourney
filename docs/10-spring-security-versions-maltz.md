# Spring Security versions, through Maxwell Maltz's Psycho-Cybernetics

## The Maltz lens

Maltz: the mind is a **servo-mechanism** (automatic goal-seeking system), steered by a **self-image** and corrected by **negative feedback**.

| Maltz idea | Spring Security equivalent |
|---|---|
| Self-image: you act by who you believe you are | `SecurityContext` / `Authentication`: the system acts by who it believes the caller is |
| Servo-mechanism: automatic guidance | The filter chain runs before your controller, automatically |
| Goal / target | Authorization rules (`requestMatchers(...).hasAuthority(...)`) |
| Negative feedback: torpedo corrects course | 401 / 403 / redirect to login via `ExceptionTranslationFilter` |
| Theater of the mind: rehearse first | Security tests (`@WithMockUser`, `jwt()`) |
| Habits | Secure defaults; deprecations that break old habits |
| Dehypnosis: drop unchecked false beliefs | Zero trust: B validates the token even though A did |

## Era 1: Acegi Security (2003–2007) — the "old self-image"
Long XML wiring of every filter by hand. No automatic mechanism yet; every action took conscious effort.

## Era 2: Spring Security 2.0–3.x (2008–2013) — setting the goal
- 2.0: renamed Spring Security; `<http>` namespace
- 3.0: SpEL (`hasRole('ADMIN')`), `@PreAuthorize`
- 3.2: Java config (`@EnableWebSecurity` + `WebSecurityConfigurerAdapter`), CSRF and security headers on by default

```java
// 3.2 – 5.x style
@EnableWebSecurity
public class Config extends WebSecurityConfigurerAdapter {
    @Override
    protected void configure(HttpSecurity http) throws Exception {
        http.authorizeRequests()
                .antMatchers("/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated()
            .and()
            .formLogin();
    }
}
```
Maltz: goal-setting; CSRF by default = a healthy habit.

## Era 3: Spring Security 4.x (2015–2017) — rehearsal
WebSocket and Spring Data integration; test support `@WithMockUser`.
```java
@Test
@WithMockUser(roles = "ADMIN")
void adminCanOpenAdminPage() throws Exception {
    mvc.perform(get("/admin")).andExpect(status().isOk());
}
```
Maltz: theater of the mind.

## Era 4: Spring Security 5.x (2017–2022) — modern identity, new habit
- Reactive (WebFlux) security
- OAuth2 login (5.0), Resource Server with JWT (5.1), replacing `spring-security-oauth`
- `DelegatingPasswordEncoder` (`{bcrypt}`, `{noop}`)
- `SecurityFilterChain` **bean** (5.4); `WebSecurityConfigurerAdapter` deprecated (5.7)
- `authorizeHttpRequests` + `AuthorizationManager`
- Spring Authorization Server started separately (1.0 in Nov 2022)

```java
// 5.7+ style
@Bean
SecurityFilterChain chain(HttpSecurity http) throws Exception {
    http.authorizeHttpRequests(a -> a
            .requestMatchers("/admin/**").hasRole("ADMIN")
            .anyRequest().authenticated())
        .oauth2ResourceServer(o -> o.jwt(Customizer.withDefaults()));
    return http.build();
}
```
Maltz: breaking an old habit through practice; JWT resource server = dehypnosis (verify, don't blindly trust a session).

## Era 5: Spring Security 6.x (2022–2025) — new self-image made permanent
- 6.0 (Boot 3, Java 17, Jakarta): adapter **removed**; `antMatchers` → `requestMatchers`; `authorizeRequests` → `authorizeHttpRequests`; `@EnableMethodSecurity`; SecurityContext saved explicitly
- 6.1: lambda DSL expected, `.and()` deprecated
- 6.3: compromised password checking
- 6.4: one-time token login, passkeys (WebAuthn), OAuth2 support for `RestClient`
- **Your project:** Boot 3.5.5 → Spring Security 6.5 + Authorization Server 1.5

## Era 6: Spring Security 7.x (2025–now) — integration
- 7.0 (Boot 4): Authorization Server **merged into Spring Security** → starter renamed, `http.oauth2AuthorizationServer(...)` exists only in 7
- Built-in **MFA** (`@EnableMultiFactorAuthentication`)
- Lambda DSL required
- 7.1 is the current stable line (DPoP-bound tokens, protected resource metadata in the reference)

```java
// 7.x
http.oauth2AuthorizationServer(as -> as.oidc(Customizer.withDefaults()))
    .authorizeHttpRequests(a -> a.anyRequest().authenticated());
```
Maltz: the integrated personality; MFA = confidence based on evidence.

## Timeline

| Era | Versions (approx.) | Headline change | Maltz idea |
|---|---|---|---|
| Acegi | 2003–2007 | Manual XML wiring | No automatic mechanism |
| Namespace + expressions | 2.0–3.1 | `<http>`, SpEL, `@PreAuthorize` | Clear goals |
| Java config | 3.2 | Adapter, CSRF by default | Good habits |
| Test support | 4.x | `@WithMockUser` | Theater of the mind |
| OAuth2 + reactive | 5.x | OAuth2, JWT RS, bean config | Breaking habits; dehypnosis |
| Modern baseline | 6.x | Adapter removed, passkeys, OTT | New self-image |
| Unified | 7.x | Auth Server merged, MFA | Integrated personality |

## Interview use
Lead with the technical story; use Maltz as a memory aid:
> "Spring Security evolved from manual XML wiring in Acegi, to namespace config, to Java config with `WebSecurityConfigurerAdapter`, to `SecurityFilterChain` beans in 5.7, mandatory in 6.0. OAuth2 moved into core in 5.x, and in 7.0 the Authorization Server joined Spring Security, with built-in MFA. I think of it as a servo-mechanism: the filter chain steers every request toward the declared rules, and 401/403 are its negative feedback."

| Question | Short answer |
|---|---|
| Why was `WebSecurityConfigurerAdapter` removed? | Inheritance was rigid; beans compose and allow several chains |
| `authorizeRequests` vs `authorizeHttpRequests`? | New one uses `AuthorizationManager`, applies to every dispatch type |
| Authorization Server in 6 vs 7? | Separate project (1.x) in 6; merged in 7 |
| SecurityContext in 6.0? | No longer saved automatically; save explicitly |
| Passwordless? | Passkeys and one-time tokens (6.4), MFA (7.0) |

Sources: [What's New in Spring Security 7.1](https://docs.enterprise.spring.io/spring-security/reference/whats-new.html) · [MFA in Spring Security 7](https://spring.io/blog/2025/10/21/multi-factor-authentication-in-spring-security-7/) · [Authorization Server in Spring Security 7](https://dimitri.codes/authorization-server/)
