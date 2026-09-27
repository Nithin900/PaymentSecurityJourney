# Payment Microservice

Three Spring Boot modules built and versioned together via a single parent `pom.xml`:

| Module | Port | Role |
|---|---|---|
| `payment-authorization-server` | 9000 | OAuth2/OIDC Authorization Server - login, consent, issues JWTs |
| `payment-service-b` | 8081 | Payment persistence (JPA + H2) - OAuth2 Resource Server |
| `payment-service-a` | 8080 | Payment gateway - OAuth2 Resource Server, calls into service-b |

**Start `payment-authorization-server` first.** The other two validate JWTs against its `issuer-uri` (`http://localhost:9000`) and will work even if it's briefly unreachable at boot, but you need it running to actually get a token.

Login credentials for the authorization server (`http://localhost:9000/login`): **`nithin` / `password`**.

---

## Way 1 - Launcher script (recommended)

One command starts all three, in the correct order, and waits for each port to open before starting the next:

```powershell
.\scripts\start-all.ps1
```

Logs go to `scripts\logs\<module>.log`. Stop everything with:

```powershell
.\scripts\stop-all.ps1
```

Use this for day-to-day running/testing. It's the only method that starts all three with a single command.

---

## Way 2 - Maven, one module at a time

Useful when you only need one or two services, or want to watch a single service's console output directly.

From the repo root, target a module with `-pl` (don't run `mvn spring-boot:run` bare from the root - it's just the aggregator pom and has no main class):

```powershell
mvn spring-boot:run -pl payment-authorization-server
```

Open a **separate terminal per service** (each blocks the terminal while running) and start the others the same way, in order:

```powershell
mvn spring-boot:run -pl payment-service-b
mvn spring-boot:run -pl payment-service-a
```

Equivalently, `cd` into a module directory and run its wrapper directly:

```powershell
cd payment-authorization-server
.\mvnw.cmd spring-boot:run
```

Stop each with `Ctrl+C` in its terminal.

---

## Way 3 - Run/Debug from IntelliJ IDEA

Best when you want breakpoints, hot-reload, or to step through code.

1. Open the repo root in IntelliJ (it should auto-import as a multi-module Maven project - if not, right-click the root `pom.xml` → **Add as Maven Project**).
2. For each module, open its `*Application.java` main class and click the green **Run** (or **Debug**) arrow next to `main`:
   - `payment_authorization_server/PaymentAuthorizationServerApplication.java`
   - `org.example/PaymentServiceAppliaction.java` (service-b)
   - `com.example.PaymentA/PaymentAApplication.java` (service-a)
3. Start them in the same order as above (auth-server → service-b → service-a). Each opens as its own Run tab, so you get separate console output and can restart one without touching the others.

---

## Testing the OAuth2 flow

See `postman/PaymentMicroService.postman_collection.json` - import it into Postman for the full manual login → consent → token → payment walkthrough, plus ready-to-run requests against both services.
