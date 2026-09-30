# NotificationService: build guide (files + code)

Payment create ayyaka user ki email pampe service. Idi guide: **e file ekkada, dantlo e code** untundi. Mee chetho ee files create chesi code paste/type cheyyandi.

```
Client -> A (8080) -> B (8081) saves payment -> NotificationService (8082) -> real SMTP (Gmail smtp.gmail.com:587)
```

- B payment commit ayyaka `POST /notifications` call chestundi.
- Notification fail ayina payment fail avvadu.
- B own `client_credentials` token tho call chestundi (scope `notification.send`).

## 0. Mundu teliyalsina gotchas

1. **Boot version.** Migilina modules Boot **3.5.5**, skeleton Boot **4.1.1**. Ee guide **3.5.5 (root parent)** ki rasindi. Section 1 lo pom marchali.
2. **`spring.mail.host` undali**, lekapothe `JavaMailSender` bean undadu (yaml lo already undi).
3. **B ki netty kavali** (`reactor-netty-http`), lekapothe `io.netty` compile error.
5. **Real SMTP vadutunnaru (Mailpit kaadu).** Moodu marpulu: (a) Section 3 lo Gmail mail config + secrets env vars lo, (b) Section 5.4 lo recipient logic marchali (`nithin@example.local` ki real mail veladu), (c) Section 6 lo Gmail App Password setup. Mailpit/Docker avasaram ledu.
4. Ee guide lo NotificationService code nenu oka sari build chesi test run chesanu, kani final test result chudaledu. B side code (Section 7) compile check cheyyaledu (netty error tarvata aapesaru). Kabatti B side kotta gaa run chesi chudandi.

Package everywhere: `com.example.NotificationService` (mee skeleton laage).

---

## 1. `NotificationService/pom.xml` (replace motham)

Root parent ki align (Boot 3.5.5) + normal starters.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
         https://maven.apache.org/xsd/maven-4.0.0.xsd">

    <modelVersion>4.0.0</modelVersion>

    <parent>
        <groupId>com.payment</groupId>
        <artifactId>payment-microservice</artifactId>
        <version>0.0.1-SNAPSHOT</version>
        <relativePath>../pom.xml</relativePath>
    </parent>

    <groupId>com.payment</groupId>
    <artifactId>notification-service</artifactId>
    <version>0.0.1-SNAPSHOT</version>

    <name>notification-service</name>
    <description>Payment Notification Microservice (email)</description>

    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-mail</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-thymeleaf</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-validation</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-oauth2-resource-server</artifactId>
        </dependency>

        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>org.springframework.security</groupId>
            <artifactId>spring-security-test</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
            </plugin>
        </plugins>
    </build>

</project>
```

## 2. Root `pom.xml`: module add

`<modules>` lo add:

```xml
<module>NotificationService</module>
```

## 3. `src/main/resources/application.yaml`

Real SMTP (Gmail) kosam **motham ee file ni ila marchandi**:

```yaml
server:
  port: 8082

spring:
  application:
    name: NotificationService
  mail:
    host: smtp.gmail.com
    port: 587
    username: ${MAIL_USERNAME:}      # secrets env vars nundi, file lo rayakandi
    password: ${MAIL_PASSWORD:}      # Gmail App Password (16 chars), normal password kaadu
    properties:
      mail:
        smtp:
          auth: true
          starttls:
            enable: true
            required: true
          connectiontimeout: 5000    # timeouts lekapothe SMTP down aite request hang avthundi
          timeout: 5000
          writetimeout: 5000
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: http://localhost:9000

notification:
  from: ${MAIL_USERNAME:payments@paymentmicroservice.local}   # Gmail lo from = login account ayi undali
  recipient: ${NOTIFICATION_RECIPIENT:}    # dev: andariki ee oka address ki pampali (Section 5.4)
  recipient-domain: example.local          # recipient khali aite fallback (real SMTP lo deliver avvadu)
```

- **Secrets file lo rayakandi**, `application.yaml` git ki veltundi. `${MAIL_USERNAME:}` ante env var nundi teesuko, lekapothe khali. Khali default undi kabatti `mvn test` env vars lekunda kuda pass avthundi.
- Env vars set (PowerShell, **service start chese same window lo**):
  ```powershell
  $env:MAIL_USERNAME = "yourname@gmail.com"
  $env:MAIL_PASSWORD = "abcdefghijklmnop"        # App Password, spaces lekunda
  $env:NOTIFICATION_RECIPIENT = "yourname@gmail.com"
  .\scripts\start-all.ps1
  ```
  `start-all.ps1` start chese processes ee window nundi env vars inherit chestayi.

## 4. Auth server: kotha client

File: `payment-authorization-server/src/main/java/com/example/payment_authorization_server/Config/SecurityConfig.java`

`registeredClientRepository()` lo, `return` mundu:

```java
// Machine-to-machine: service B calls the notification service with its own token
RegisteredClient serviceBClient = RegisteredClient.withId(UUID.randomUUID().toString())
        .clientId("payment-service-b")
        .clientSecret("{noop}b-secret")
        .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
        .authorizationGrantType(AuthorizationGrantType.CLIENT_CREDENTIALS)
        .scope("notification.send")
        .tokenSettings(TokenSettings.builder().accessTokenTimeToLive(Duration.ofMinutes(5)).build())
        .build();
```

`return` ni ila marchandi:

```java
return new InMemoryRegisteredClientRepository(paymentClient, serviceBClient);
```

Verify (auth server run lo undi):

```powershell
$b = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("payment-service-b:b-secret"))
Invoke-RestMethod -Method Post -Uri http://localhost:9000/oauth2/token -Headers @{Authorization="Basic $b"} -Body @{grant_type="client_credentials"; scope="notification.send"}
```

---

## 5. NotificationService files

Base folder: `NotificationService/src/main/java/com/example/NotificationService/`

### 5.1 `DTO/NotificationRequest.java`

```java
package com.example.NotificationService.DTO;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

public class NotificationRequest {

    @NotBlank
    private String paymentId;

    @NotBlank
    private String owner;

    @NotNull
    @Positive
    private BigDecimal amount;

    @NotBlank
    private String status;

    public NotificationRequest() {
    }

    public NotificationRequest(String paymentId, String owner, BigDecimal amount, String status) {
        this.paymentId = paymentId;
        this.owner = owner;
        this.amount = amount;
        this.status = status;
    }

    public String getPaymentId() { return paymentId; }
    public void setPaymentId(String paymentId) { this.paymentId = paymentId; }

    public String getOwner() { return owner; }
    public void setOwner(String owner) { this.owner = owner; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}
```

### 5.2 `DTO/NotificationResponse.java`

```java
package com.example.NotificationService.DTO;

public class NotificationResponse {

    private String paymentId;
    private String status;
    private String message;

    public NotificationResponse() {
    }

    public NotificationResponse(String paymentId, String status, String message) {
        this.paymentId = paymentId;
        this.status = status;
        this.message = message;
    }

    public String getPaymentId() { return paymentId; }
    public void setPaymentId(String paymentId) { this.paymentId = paymentId; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
}
```

### 5.3 `Service/NotificationService.java`

```java
package com.example.NotificationService.Service;

import com.example.NotificationService.DTO.NotificationRequest;
import com.example.NotificationService.DTO.NotificationResponse;

public interface NotificationService {

    NotificationResponse send(NotificationRequest request);
}
```

### 5.4 `Service/EmailNotificationService.java`

```java
package com.example.NotificationService.Service;

import com.example.NotificationService.DTO.NotificationRequest;
import com.example.NotificationService.DTO.NotificationResponse;
import com.example.NotificationService.Exceptions.NotificationFailedException;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.nio.charset.StandardCharsets;

@Service
public class EmailNotificationService implements NotificationService {

    private static final Logger log = LoggerFactory.getLogger(EmailNotificationService.class);

    private final JavaMailSender mailSender;
    private final TemplateEngine templateEngine;
    private final String from;
    private final String recipientDomain;

    public EmailNotificationService(JavaMailSender mailSender,
                                    TemplateEngine templateEngine,
                                    @Value("${notification.from}") String from,
                                    @Value("${notification.recipient-domain}") String recipientDomain) {
        this.mailSender = mailSender;
        this.templateEngine = templateEngine;
        this.from = from;
        this.recipientDomain = recipientDomain;
    }

    @Override
    public NotificationResponse send(NotificationRequest request) {
        String to = recipientFor(request.getOwner());

        Context ctx = new Context();
        ctx.setVariable("paymentId", request.getPaymentId());
        ctx.setVariable("owner", request.getOwner());
        ctx.setVariable("amount", request.getAmount());
        ctx.setVariable("status", request.getStatus());
        String html = templateEngine.process("payment-notification", ctx);

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, StandardCharsets.UTF_8.name());
            helper.setFrom(from);
            helper.setTo(to);
            helper.setSubject("Payment " + request.getPaymentId() + ": " + request.getStatus());
            helper.setText(html, true);
            mailSender.send(message);
        } catch (MailException | MessagingException e) {
            log.error("Could not send notification for payment {} to {}", request.getPaymentId(), to, e);
            throw new NotificationFailedException("Could not send email for payment " + request.getPaymentId(), e);
        }

        log.info("Notification sent for payment {} to {}", request.getPaymentId(), to);
        return new NotificationResponse(request.getPaymentId(), "SENT", "Notification sent to " + to);
    }

    // Payments only carry the owner's username (JWT sub), so build the address from it
    private String recipientFor(String owner) {
        return owner.contains("@") ? owner : owner + "@" + recipientDomain;
    }
}
```

#### 5.4b Real SMTP kosam marpu (5.4 lo)

Payment lo email ledu, owner username matrame (`nithin`). `nithin@example.local` ki Gmail deliver cheyyadu (bounce). Kabatti dev lo **oka fixed recipient** vadandi.

Constructor lo parameter add:

```java
@Value("${notification.recipient:}") String fixedRecipient,
```
(field kuda `private final String fixedRecipient;` + constructor lo `this.fixedRecipient = fixedRecipient;`)

`recipientFor` ni ila marchandi:

```java
private String recipientFor(String owner) {
    if (!fixedRecipient.isBlank()) {
        return fixedRecipient;                       // dev: anni mails ee address ki
    }
    return owner.contains("@") ? owner : owner + "@" + recipientDomain;
}
```

Production lo username -> email kosam user service/DB nundi lookup cheyyali. Ippudu adi scope lo ledu.

### 5.5 `Controller/NotificationController.java`

```java
package com.example.NotificationService.Controller;

import com.example.NotificationService.DTO.NotificationRequest;
import com.example.NotificationService.DTO.NotificationResponse;
import com.example.NotificationService.Service.NotificationService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @PostMapping
    public NotificationResponse send(@Valid @RequestBody NotificationRequest request) {
        return notificationService.send(request);
    }
}
```

### 5.6 `Config/SecurityConfig.java`

```java
package com.example.NotificationService.Config;

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
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/error").permitAll()
                        .requestMatchers(HttpMethod.POST, "/notifications/**").hasAuthority("SCOPE_notification.send")
                        .anyRequest().authenticated())
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()))
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .csrf(csrf -> csrf.disable());
        return http.build();
    }
}
```

### 5.7 `Exceptions/NotificationFailedException.java`

```java
package com.example.NotificationService.Exceptions;

public class NotificationFailedException extends RuntimeException {

    public NotificationFailedException(String message, Throwable cause) {
        super(message, cause);
    }
}
```

### 5.8 `Exceptions/ErrorResponse.java`

```java
package com.example.NotificationService.Exceptions;

import java.time.LocalDateTime;

public class ErrorResponse {
    private String message;
    private int status;
    private String error;
    private String path;
    private LocalDateTime timestamp;

    public ErrorResponse(LocalDateTime timestamp, int status, String error, String message, String path) {
        this.timestamp = timestamp;
        this.status = status;
        this.error = error;
        this.message = message;
        this.path = path;
    }

    public String getMessage() { return message; }
    public int getStatus() { return status; }
    public String getError() { return error; }
    public String getPath() { return path; }
    public LocalDateTime getTimestamp() { return timestamp; }
}
```

### 5.9 `Exceptions/GlobalExceptionHandler.java`

```java
package com.example.NotificationService.Exceptions;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.LocalDateTime;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(NotificationFailedException.class)
    public ResponseEntity<ErrorResponse> handleNotificationFailed(NotificationFailedException e, HttpServletRequest request) {
        ErrorResponse error = new ErrorResponse(LocalDateTime.now(),
                HttpStatus.BAD_GATEWAY.value(), "NOTIFICATION_FAILED",
                e.getMessage(), request.getRequestURI());
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(error);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException e, HttpServletRequest request) {
        var fieldError = e.getBindingResult().getFieldErrors().get(0);
        ErrorResponse error = new ErrorResponse(LocalDateTime.now(),
                HttpStatus.BAD_REQUEST.value(), "VALIDATION_ERROR",
                fieldError.getField() + " " + fieldError.getDefaultMessage(), request.getRequestURI());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleMalformedBody(HttpMessageNotReadableException e, HttpServletRequest request) {
        ErrorResponse error = new ErrorResponse(LocalDateTime.now(),
                HttpStatus.BAD_REQUEST.value(), "MALFORMED_REQUEST_BODY",
                "Request body is missing or not valid JSON", request.getRequestURI());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
    }
}
```

### 5.10 `src/main/resources/templates/payment-notification.html`

```html
<!DOCTYPE html>
<html xmlns:th="http://www.thymeleaf.org">
<head>
    <meta charset="UTF-8"/>
    <title>Payment notification</title>
</head>
<body style="font-family: Arial, sans-serif; color: #222;">
<h2>Hi <span th:text="${owner}">user</span>,</h2>
<p>Your payment <strong th:text="${paymentId}">PAY-1</strong> is
    <strong th:text="${status}">SUCCESS</strong>.</p>
<table cellpadding="6">
    <tr><td>Payment ID</td><td th:text="${paymentId}">PAY-1</td></tr>
    <tr><td>Amount</td><td th:text="${#numbers.formatDecimal(amount, 1, 'COMMA', 2, 'POINT')}">100.50</td></tr>
    <tr><td>Status</td><td th:text="${status}">SUCCESS</td></tr>
</table>
<p style="color:#888; font-size: 12px;">This is an automated message from the Payment Microservice.</p>
</body>
</html>
```

### 5.11 `src/test/java/com/example/NotificationService/NotificationServiceApplicationTests.java` (replace)

```java
package com.example.NotificationService;

import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Properties;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class NotificationServiceApplicationTests {

    private static final String BODY =
            "{\"paymentId\":\"PAY-1\",\"owner\":\"nithin\",\"amount\":100.50,\"status\":\"SUCCESS\"}";

    @Autowired
    MockMvc mvc;

    @MockBean
    JavaMailSender mailSender;

    @MockBean
    JwtDecoder jwtDecoder;   // so the test never connects to the auth server

    private void stubMimeMessage() {
        when(mailSender.createMimeMessage()).thenReturn(new MimeMessage(Session.getInstance(new Properties())));
    }

    @Test
    void withoutToken_returns401() throws Exception {
        mvc.perform(post("/notifications").contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void withoutSendScope_returns403() throws Exception {
        mvc.perform(post("/notifications")
                        .with(jwt().authorities(() -> "SCOPE_payment.read"))
                        .contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isForbidden());
    }

    @Test
    void validRequest_sendsMailAndReturnsSent() throws Exception {
        stubMimeMessage();

        mvc.perform(post("/notifications")
                        .with(jwt().authorities(() -> "SCOPE_notification.send"))
                        .contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paymentId").value("PAY-1"))
                .andExpect(jsonPath("$.status").value("SENT"));

        verify(mailSender).send(any(MimeMessage.class));
    }

    @Test
    void invalidBody_returns400() throws Exception {
        mvc.perform(post("/notifications")
                        .with(jwt().authorities(() -> "SCOPE_notification.send"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentId\":\"\",\"owner\":\"nithin\",\"amount\":-5,\"status\":\"SUCCESS\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
    }

    @Test
    void mailFailure_returns502() throws Exception {
        stubMimeMessage();
        doThrow(new MailSendException("smtp down")).when(mailSender).send(any(MimeMessage.class));

        mvc.perform(post("/notifications")
                        .with(jwt().authorities(() -> "SCOPE_notification.send"))
                        .contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.error").value("NOTIFICATION_FAILED"));
    }
}
```

Run:

```powershell
mvn -pl NotificationService test
```

---

## 6. Real SMTP: Gmail setup

Docker/Mailpit avasaram ledu. Gmail lo ivi cheyyali:

1. Google account lo **2-Step Verification ON** cheyyandi (App Password kosam mandatory).
2. https://myaccount.google.com/apppasswords lo **App Password** generate cheyyandi (peru: `payment-notification`). 16 chars vastayi. Adi `MAIL_PASSWORD`. Normal Gmail password **vadakandi**, reject avthundi (`535 Authentication failed`).
3. Section 3 lo laage env vars set cheyyandi (`MAIL_USERNAME`, `MAIL_PASSWORD`, `NOTIFICATION_RECIPIENT`).

**Jagratthalu:**
- App Password ni code/yaml/README/git lo **eppudu rayakandi**. Commit ayite Google account revoke cheyyandi.
- Gmail lo `From` header login account ke rewrite avthundi, kabatti `notification.from` = `MAIL_USERNAME` pettandi.
- Dev lo **mee own address ki matrame** pampandi (`NOTIFICATION_RECIPIENT`). Test payments tho random users ki email veltayi.
- Gmail day limit undi (personal account ~500 mails/day).
- Corporate/college network lo port 587 block aite `Connection timed out` vastundi.

---

## 7. Service B: notification call

### 7.1 `payment-service-b/pom.xml`: dependencies add

```xml
<!-- client_credentials token for calling the notification service -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-oauth2-client</artifactId>
</dependency>
<!-- netty for the WebClient timeouts -->
<dependency>
    <groupId>io.projectreactor.netty</groupId>
    <artifactId>reactor-netty-http</artifactId>
</dependency>
```

### 7.2 `payment-service-b/src/main/resources/application.properties`: end lo add

```properties
# Service-to-service: B gets its own client_credentials token to call the notification service
spring.security.oauth2.client.provider.auth-server.token-uri=http://localhost:9000/oauth2/token
spring.security.oauth2.client.registration.notification.provider=auth-server
spring.security.oauth2.client.registration.notification.client-id=payment-service-b
spring.security.oauth2.client.registration.notification.client-secret=b-secret
spring.security.oauth2.client.registration.notification.authorization-grant-type=client_credentials
spring.security.oauth2.client.registration.notification.client-authentication-method=client_secret_basic
spring.security.oauth2.client.registration.notification.scope=notification.send

notification.base-url=http://localhost:8082
```

### 7.3 `payment-service-b/src/main/java/org/example/Config/NotificationClientConfig.java` (new)

```java
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
                                           @Value("${notification.base-url}") String baseUrl) {
        // Service-based manager: works outside a user's login session (client_credentials has no user)
        var manager = new AuthorizedClientServiceOAuth2AuthorizedClientManager(registrations, clientService);
        var oauth = new ServletOAuth2AuthorizedClientExchangeFilterFunction(manager);
        oauth.setDefaultClientRegistrationId("notification");

        HttpClient http = HttpClient.create()
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 2000)
                .responseTimeout(Duration.ofSeconds(3));

        return WebClient.builder()
                .baseUrl(baseUrl)
                .clientConnector(new ReactorClientHttpConnector(http))
                .apply(oauth.oauth2Configuration())
                .build();
    }
}
```

### 7.4 `payment-service-b/src/main/java/org/example/Notification/PaymentCreatedEvent.java` (new)

```java
package org.example.Notification;

import java.math.BigDecimal;

public record PaymentCreatedEvent(String paymentId, String owner, BigDecimal amount) {
}
```

### 7.5 `payment-service-b/src/main/java/org/example/Notification/NotificationListener.java` (new)

```java
package org.example.Notification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.Map;

/**
 * Tells the notification service about a new payment, but only after the payment is committed,
 * and never lets a notification failure affect the payment itself.
 */
@Component
public class NotificationListener {

    private static final Logger log = LoggerFactory.getLogger(NotificationListener.class);

    private final WebClient notificationWebClient;

    public NotificationListener(WebClient notificationWebClient) {
        this.notificationWebClient = notificationWebClient;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onPaymentCreated(PaymentCreatedEvent event) {
        try {
            notificationWebClient.post()
                    .uri("/notifications")
                    .bodyValue(Map.of(
                            "paymentId", event.paymentId(),
                            "owner", event.owner(),
                            "amount", event.amount(),
                            "status", "SUCCESS"))
                    .retrieve()
                    .toBodilessEntity()
                    .block();
            log.info("Notification requested for payment {}", event.paymentId());
        } catch (Exception e) {
            log.warn("Payment {} saved, but the notification could not be sent: {}", event.paymentId(), e.getMessage());
        }
    }
}
```

### 7.6 `payment-service-b/src/main/java/org/example/Service/PaymentServiceImpl.java` (edit)

Imports add:

```java
import org.example.Notification.PaymentCreatedEvent;
import org.springframework.context.ApplicationEventPublisher;
```

Constructor marchandi:

```java
private final PaymentRepository paymentRepository;
private final ApplicationEventPublisher events;

public PaymentServiceImpl(PaymentRepository paymentRepository, ApplicationEventPublisher events) {
    this.paymentRepository = paymentRepository;
    this.events = events;
}
```

`paymentRepository.save(paymentEntity);` tarvata:

```java
// Notify after commit (see NotificationListener)
events.publishEvent(new PaymentCreatedEvent(
        paymentEntity.getId(), paymentEntity.getOwner(), paymentEntity.getAmount()));
```

---

## 8. `scripts/start-all.ps1`

`$services` lo auth server tarvata, B mundu add:

```powershell
@{ Name = "NotificationService";          Port = 8082 },
```

Order: auth -> notification -> B -> A.

---

## 9. End-to-end check

1. Env vars set cheyyandi (Section 3) **aa same PowerShell window lo**.
2. `.\scripts\start-all.ps1`
3. Normal login flow tho token techukoni (`$h` set cheyyandi), tarvata:
   ```powershell
   $body = @{ paymentId="PAY-N1"; accountNumber="ACC123"; amount=100.50 } | ConvertTo-Json
   Invoke-RestMethod -Method Post -Uri http://localhost:8080/payments -Headers $h -ContentType "application/json" -Body $body
   ```
4. `NOTIFICATION_RECIPIENT` address inbox lo email kanipinchali (spam folder kuda chudandi, modati sari akkadiki veltundi).
5. **Failure case:** `MAIL_PASSWORD` ni tappu value ki marchi (leda env var teesesi) service restart chesi payment create cheyyandi. Payment **SUCCESS** ravali, NotificationService log lo `535 Authentication failed`, B log lo "notification could not be sent" warning undali.
6. Notification service ki direct, `payment-client` token tho (scope `payment.write`) `POST /notifications` **403** ravali.

## 10. Checklist

- [ ] 1 pom (Boot 3.5.5 parent) + 2 root module
- [ ] 3 `application.yaml` (Gmail config, `server.port`)
- [ ] 4 auth server client `payment-service-b`
- [ ] 5.1 to 5.11 files (+ 5.4b recipient change) + tests green
- [ ] 6 Gmail App Password + env vars (`MAIL_USERNAME`, `MAIL_PASSWORD`, `NOTIFICATION_RECIPIENT`), git lo secrets ledu
- [ ] 7.1 to 7.6 service B
- [ ] 8 `start-all.ps1`
- [ ] 9 end-to-end + failure case
