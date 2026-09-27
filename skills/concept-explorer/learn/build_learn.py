"""Builds learn.html: the interview study guide that sits next to the explorer."""
import html, re, sys

import os
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../site/learn.html')

def code(src, lang='java'):
    s = html.escape(src.strip('\n'))
    if lang == 'java':
        s = re.sub(r'(//[^\n]*)', r'<span class="c">\1</span>', s)
        s = re.sub(r'(?<![\w"])(@[A-Z][A-Za-z0-9]*)', r'<span class="a">\1</span>', s)
    else:
        s = re.sub(r'(#[^\n]*)', r'<span class="c">\1</span>', s)
    return '<pre class="code"><code>' + s + '</code></pre>'

TOPICS = [
# ---------------------------------------------------------------------------
dict(id='di', n=1, title='IoC & Dependency Injection', area='Spring Core',
 problem='Classes that create their own dependencies with <code>new</code> are tightly coupled and hard to test. Spring creates the objects (beans) and hands each class what it needs.',
 inside='Component scan → <code>BeanDefinition</code>s in <code>DefaultListableBeanFactory</code> → at startup every singleton is created → constructor parameters resolved <b>by type</b> (then <code>@Qualifier</code>, <code>@Primary</code>, parameter name).',
 use=code('''
@Service
public class PaymentService {
    private final PaymentRepository repository;
    private final FeeCalculator feeCalculator;

    // single constructor → Spring injects it, no @Autowired needed
    public PaymentService(PaymentRepository repository, FeeCalculator feeCalculator) {
        this.repository = repository;
        this.feeCalculator = feeCalculator;
    }
}

@Configuration
public class ClockConfig {
    @Bean                       // a class you can't annotate (JDK, library) as a bean
    Clock clock() {
        return Clock.systemUTC();
    }
}'''),
 breaks=['Two beans of the same type → <code>NoUniqueBeanDefinitionException</code> at startup.',
         'No bean of the type (class outside the scanned package) → <code>NoSuchBeanDefinitionException</code>.',
         'Circular dependency A ↔ B → startup fails (Boot forbids it by default).',
         'Field injection: dependency is <code>null</code> inside the constructor and hidden from tests.'],
 breakcode=code('''
// two PaymentGateway beans → pick one explicitly
public PaymentService(@Qualifier("stripeGateway") PaymentGateway gateway) { ... }

// or mark the default implementation
@Primary
@Component
class StripeGateway implements PaymentGateway { ... }'''),
 answer=['Spring\'s container creates and wires my objects instead of me calling <code>new</code>.',
         'It scans @Component classes into bean definitions, creates singletons at startup and injects constructor parameters by type, using @Qualifier or @Primary when there are several.',
         'I use constructor injection with final fields — in SecurePay the controller gets PaymentService injected; wiring mistakes fail at startup, not in production.'],
 check=[('Why prefer constructor injection over field injection?','Dependencies are explicit and final, the object is complete after construction, and unit tests can pass mocks without Spring.'),
        ('What happens if two beans implement the same interface?','NoUniqueBeanDefinitionException at startup unless @Qualifier, @Primary or a matching parameter name picks one; or inject List<T> to get all.'),
        ('When are singleton beans created?','At startup (preInstantiateSingletons), so wiring errors fail fast — unless lazy initialization is on.')],
 links=[('core',2,'One bean\'s full lifecycle'),('core',3,'Injection: which bean?'),('core',4,'Circular dependency')]),
# ---------------------------------------------------------------------------
dict(id='lifecycle', n=2, title='Bean lifecycle & scopes', area='Spring Core',
 problem='Some beans must do work after injection (load a cache) or before shutdown (close a client); some objects must not be shared.',
 inside='constructor → field/setter injection → Aware callbacks → BeanPostProcessor before-init (runs <code>@PostConstruct</code>) → <code>afterPropertiesSet</code>/initMethod → BeanPostProcessor after-init (proxies created here) → ready … <code>@PreDestroy</code> at shutdown.',
 use=code('''
@Component
public class RateCache {
    private final RateClient client;
    private Map<String, BigDecimal> rates;

    public RateCache(RateClient client) {   // 1. constructor
        this.client = client;
    }

    @PostConstruct                           // 2. after injection
    void load() {
        rates = client.fetchAll();
    }

    @PreDestroy                              // 3. on shutdown
    void clear() {
        rates.clear();
    }
}

// prototype bean used from a singleton: ask the container each time
@Service
class ReportService {
    private final ObjectProvider<ReportBuilder> builders;   // ReportBuilder is @Scope("prototype")

    ReportService(ObjectProvider<ReportBuilder> builders) {
        this.builders = builders;
    }

    Report create() {
        return builders.getObject().build();                 // new instance per call
    }
}'''),
 breaks=['A prototype bean injected directly into a singleton is created only once.',
         'Calling this bean\'s own <code>@Transactional</code> method from <code>@PostConstruct</code> runs without a transaction (no proxy yet + self-invocation).',
         'Prototype beans never get <code>@PreDestroy</code>.'],
 breakcode='',
 answer=['Spring constructs the bean, injects dependencies, runs @PostConstruct, then post-processors may wrap it in a proxy; @PreDestroy runs at shutdown.',
         'Order: constructor → injection → Aware → @PostConstruct → afterPropertiesSet → BeanPostProcessor after-init (AOP proxy) → destroy callbacks.',
         'Default scope is singleton; for per-call objects I use prototype with ObjectProvider, and request scope uses a scoped proxy.'],
 check=[('Where in the lifecycle is the @Transactional proxy created?','In BeanPostProcessor after-initialization (the auto-proxy creator), after @PostConstruct.'),
        ('Why does a prototype injected into a singleton behave like a singleton?','Injection happens once, when the singleton is created. Use ObjectProvider, @Lookup or a scoped proxy.'),
        ('Which beans get destroy callbacks?','Singletons at shutdown, request/session beans at the end of the request/session; prototypes never.')],
 links=[('core',2,'One bean\'s full lifecycle'),('core',18,'Scopes: prototype & request bean')]),
# ---------------------------------------------------------------------------
dict(id='aop', n=3, title='AOP & proxies', area='Spring Core',
 problem='Cross-cutting code (transactions, security, timing, caching) would otherwise be copied into every method.',
 inside='A BeanPostProcessor (<code>AnnotationAwareAspectJAutoProxyCreator</code>) finds advisors matching the bean and replaces it with a <b>CGLIB subclass proxy</b> (Boot default). Calls from outside go through the interceptor chain, then to the real object.',
 use=code('''
@Aspect
@Component
public class TimingAspect {
    private static final Logger log = LoggerFactory.getLogger(TimingAspect.class);

    @Around("@annotation(com.securepay.Timed)")
    public Object time(ProceedingJoinPoint pjp) throws Throwable {
        long start = System.nanoTime();
        try {
            return pjp.proceed();                       // must call proceed()
        } finally {
            log.info("{} took {} ms", pjp.getSignature().toShortString(),
                     (System.nanoTime() - start) / 1_000_000);
        }
    }
}'''),
 breaks=['<b>Self-invocation</b>: <code>this.method()</code> skips the proxy → @Transactional, @Async, @Cacheable, @PreAuthorize do nothing.',
         '<code>final</code> methods are not overridden by CGLIB (they run on the proxy with null fields → NPE); <code>private</code> methods get no advice.',
         'An @Aspect without <code>@Component</code> (or @Bean) is never registered — @Aspect is not picked up by component scanning, so the advice silently never runs. (@Aspect needs aspectjweaver, via spring-boot-starter-aop.)'],
 breakcode=code('''
public void process(PaymentRequest r) {
    this.save(r);        // ❌ direct call on the target: @Transactional on save() is ignored
}
// fix: move save() to another bean and call it through that bean'''),
 answer=['Spring AOP wraps a bean in a proxy that runs extra logic around method calls.',
         'The auto-proxy creator (a BeanPostProcessor) builds a CGLIB proxy with an interceptor chain; the last interceptor calls the real object.',
         'Because it\'s proxy-based, internal this.x() calls, final and private methods are not intercepted — I put transactional methods in a separate bean.'],
 check=[('Why doesn\'t @Transactional work on a method called from the same class?','The call uses this (the target), not the proxy, so no interceptor runs.'),
        ('JDK proxy vs CGLIB?','JDK proxies implement interfaces only; CGLIB subclasses the class. Boot defaults to CGLIB (proxy-target-class=true).'),
        ('How do @PreAuthorize and @Transactional relate?','Both are advisors on the same proxy; security runs before the transaction interceptor.')],
 links=[('core',5,'Proxy creation'),('core',10,'Self-invocation'),('core',14,'Your own @Aspect')]),
# ---------------------------------------------------------------------------
dict(id='tx', n=4, title='@Transactional', area='Transactions',
 problem='Several database writes must succeed or fail together; managing connections, commit and rollback by hand is error-prone.',
 inside='proxy → <code>TransactionInterceptor</code> → reads the attribute → <code>JpaTransactionManager.getTransaction</code> → connection + EntityManager bound to the <b>thread</b> (<code>TransactionSynchronizationManager</code>) → your method → flush + commit, or rollback.',
 use=code('''
@Service
public class PaymentService {
    private final PaymentRepository repository;
    private final AuditService auditService;          // a separate bean
    // constructor omitted

    @Transactional(rollbackFor = Exception.class)     // also roll back on checked exceptions
    public Payment refund(Long id) {
        Payment p = repository.findById(id)
                .orElseThrow(() -> new PaymentNotFoundException(id));
        p.markRefunded();                 // no save(): dirty checking → UPDATE at commit
        auditService.log("REFUND", id);   // REQUIRES_NEW: commits even if refund rolls back
        return p;
    }
}

@Service
class AuditService {
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void log(String action, Long paymentId) {
        // insert audit row in its own transaction (needs a 2nd DB connection)
    }
}'''),
 breaks=['Checked exceptions <b>commit</b> by default (only RuntimeException/Error roll back).',
         'Catching the exception inside the method → it commits.',
         'Inner REQUIRED method throws, outer catches → <code>UnexpectedRollbackException</code> at commit.',
         '<code>@Async</code> / other threads don\'t see the transaction (ThreadLocal).',
         'Long transactions (HTTP calls inside) hold a DB connection the whole time.'],
 breakcode='',
 answer=['@Transactional makes a method\'s DB work atomic: commit on success, rollback on failure.',
         'The proxy\'s TransactionInterceptor asks the PlatformTransactionManager to begin, binds the connection and EntityManager to the thread, and commits or rolls back by the rollback rules.',
         'Traps I watch: checked exceptions commit, self-invocation skips it, REQUIRES_NEW needs a second connection — in SecurePay I keep HTTP calls to Service B outside the transaction.'],
 check=[('Does a checked exception roll back?','No, it commits by default. Use rollbackFor = Exception.class (or unchecked exceptions).'),
        ('REQUIRED vs REQUIRES_NEW?','REQUIRED joins the existing transaction; REQUIRES_NEW suspends it and starts an independent one on a new connection.'),
        ('Why is a constraint violation sometimes thrown after my method returned?','The INSERT/UPDATE is flushed at commit, which happens in the proxy after your method body.')],
 links=[('core',7,'@Transactional call: commit'),('core',9,'Checked exception still commits'),('core',11,'REQUIRED: UnexpectedRollbackException'),('core',12,'REQUIRES_NEW')]),
# ---------------------------------------------------------------------------
dict(id='boot', n=5, title='Spring Boot auto-configuration', area='Spring Boot',
 problem='Plain Spring needs lots of configuration for a DataSource, JPA, MVC, Jackson, Tomcat. Boot configures sensible defaults from what\'s on the classpath.',
 inside='<code>@SpringBootApplication</code> → <code>@EnableAutoConfiguration</code> → classes listed in <code>AutoConfiguration.imports</code> → guarded by <code>@ConditionalOnClass</code> / <code>@ConditionalOnMissingBean</code> / <code>@ConditionalOnProperty</code> → processed <b>after</b> your beans so yours win.',
 use=code('''
# application.yml
server:
  port: 8081
spring:
  datasource:
    url: jdbc:h2:mem:payments
  jpa:
    open-in-view: false
payment:
  max-amount: 5000
  currency: CAD''', 'yaml') + code('''
@ConfigurationProperties("payment")
@Validated
public record PaymentProperties(@Positive BigDecimal maxAmount, @NotBlank String currency) {}

@SpringBootApplication
@ConfigurationPropertiesScan
public class ServiceBApplication {
    public static void main(String[] args) {
        SpringApplication.run(ServiceBApplication.class, args);
    }
}

// tweak Boot's ObjectMapper instead of replacing it
@Bean
Jackson2ObjectMapperBuilderCustomizer jsonCustomizer() {
    return builder -> builder.serializationInclusion(JsonInclude.Include.NON_NULL);
}'''),
 breaks=['"Why isn\'t my bean created?" → run with <code>--debug</code> and read the conditions report.',
         '<code>@EnableWebMvc</code> in a Boot app switches off Boot\'s MVC auto-configuration.',
         'Property precedence: command line > env vars > profile yml > application.yml.',
         'Bean definition overriding is disabled by default (duplicate bean names fail).'],
 breakcode='',
 answer=['Spring Boot auto-configures beans based on the classpath and my properties, and backs off when I define my own.',
         '@EnableAutoConfiguration imports ~150 auto-config classes, each guarded by conditions like @ConditionalOnClass and @ConditionalOnMissingBean, evaluated after my configuration.',
         'I override with properties first, customizers second, my own bean last — e.g. my SecurityFilterChain makes Boot\'s default security back off.'],
 check=[('How does Boot know to create a DataSource?','DataSourceAutoConfiguration matches because JDBC/Hikari classes are on the classpath and no DataSource bean exists; it binds spring.datasource.*.'),
        ('What does @SpringBootApplication combine?','@SpringBootConfiguration, @EnableAutoConfiguration and @ComponentScan.'),
        ('How do you create your own auto-configuration?','An @AutoConfiguration class with conditions, listed in META-INF/spring/…AutoConfiguration.imports.')],
 links=[('boot',1,'Startup event timeline'),('boot',4,'How a DataSource appears'),('boot',5,'Your bean replaces Boot\'s default')]),
# ---------------------------------------------------------------------------
dict(id='mvc', n=6, title='Spring MVC request flow', area='Web',
 problem='Mapping HTTP requests to Java methods, converting JSON, validating input and producing responses — without servlet boilerplate.',
 inside='Filters (incl. Security) → <code>DispatcherServlet.doDispatch</code> → <code>RequestMappingHandlerMapping</code> finds the method → <code>RequestMappingHandlerAdapter</code> resolves arguments (Jackson for <code>@RequestBody</code>) → your method → return value handler writes JSON.',
 use=code('''
@RestController
@RequestMapping("/payments")
public class PaymentController {
    private final PaymentService service;

    public PaymentController(PaymentService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<PaymentResponse> create(@Valid @RequestBody CreatePaymentRequest req,
                                                  @AuthenticationPrincipal Jwt jwt) {
        PaymentResponse created = service.create(req, jwt.getSubject());   // user from the token
        return ResponseEntity.created(URI.create("/payments/" + created.id())).body(created);
    }

    @GetMapping("/{id}")
    public PaymentResponse get(@PathVariable Long id) {
        return service.get(id);
    }
}'''),
 breaks=['Wrong method → 405, wrong Content-Type → 415, unsupported Accept → 406, bad path variable → 400.',
         'Unknown URL → 404 (<code>NoResourceFoundException</code> in 6.1+); <code>/payments/</code> no longer matches <code>/payments</code>.',
         'Returning JPA entities → lazy-loading surprises, infinite recursion; return DTOs.'],
 breakcode='',
 answer=['Every request goes through the DispatcherServlet, which finds the controller method, converts the input, calls it and writes the result.',
         'HandlerMapping picks the method from @RequestMapping info built at startup; HandlerAdapter uses argument resolvers and HttpMessageConverters (Jackson) in and out.',
         'Spring Security runs as a filter before all this — in SecurePay the JWT is validated before the DispatcherServlet sees the request.'],
 check=[('What is the DispatcherServlet?','The front controller: one servlet that dispatches every request to handler methods.'),
        ('How is @RequestBody converted?','RequestResponseBodyMethodProcessor uses an HttpMessageConverter (Jackson) chosen by Content-Type.'),
        ('Filter vs HandlerInterceptor?','Filter: servlet level, before the DispatcherServlet. Interceptor: around the handler, knows the HandlerMethod.')],
 links=[('journey',1,'Full request journey'),('mvc',2,'GET full doDispatch'),('mvc',3,'POST @RequestBody + @Valid')]),
# ---------------------------------------------------------------------------
dict(id='errors', n=7, title='Validation & error handling', area='Web',
 problem='Invalid input and business errors must become consistent HTTP responses, not stack traces.',
 inside='<code>@Valid</code> → Hibernate Validator → <code>MethodArgumentNotValidException</code> → <code>ExceptionHandlerExceptionResolver</code> finds your <code>@ExceptionHandler</code> in a <code>@RestControllerAdvice</code> → <code>ProblemDetail</code> (RFC 9457).',
 use=code('''
public record CreatePaymentRequest(
        @NotNull @Positive BigDecimal amount,
        @NotBlank @Size(min = 3, max = 3) String currency,
        @NotBlank String toAccount) {}

@RestControllerAdvice
public class GlobalErrorHandler {

    @ExceptionHandler(PaymentNotFoundException.class)
    ProblemDetail notFound(PaymentNotFoundException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ProblemDetail invalid(MethodArgumentNotValidException ex) {
        ProblemDetail pd = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
        pd.setTitle("Validation failed");
        pd.setProperty("errors", ex.getBindingResult().getFieldErrors().stream()
                .map(e -> e.getField() + ": " + e.getDefaultMessage())
                .toList());
        return pd;
    }
}'''),
 breaks=['Security 401/403 from filters never reach <code>@RestControllerAdvice</code> (use an AuthenticationEntryPoint / AccessDeniedHandler).',
         'A catch-all <code>@ExceptionHandler(Exception.class)</code> turns <code>@PreAuthorize</code> 403s into 500s unless you rethrow <code>AccessDeniedException</code>.',
         'Unhandled exceptions go to <code>/error</code>; if Security doesn\'t permit <code>/error</code> you may see 401/403 instead of 500.'],
 breakcode='',
 answer=['I validate DTOs with @Valid and map exceptions to responses in one @RestControllerAdvice.',
         'Validation failures raise MethodArgumentNotValidException; the ExceptionHandlerExceptionResolver finds the matching @ExceptionHandler and I return a ProblemDetail.',
         'Filter-level security errors bypass the advice, so in SecurePay I configure the entry point for JSON 401s and permit /error.'],
 check=[('Which exception does @Valid @RequestBody throw?','MethodArgumentNotValidException (400). Parameter constraints like @Min on @RequestParam → HandlerMethodValidationException.'),
        ('What is ProblemDetail?','Spring\'s RFC 9457 error body: type, title, status, detail, instance, plus custom properties.'),
        ('Why can\'t @RestControllerAdvice handle an invalid JWT?','The bearer filter rejects the request before the DispatcherServlet; MVC never runs.')],
 links=[('mvc',6,'Business exception → ProblemDetail'),('mvc',7,'500 → /error and the Security trap'),('journey',2,'Validation fails → 400')]),
# ---------------------------------------------------------------------------
dict(id='jpa', n=8, title='JPA: persistence context, lazy loading, N+1', area='Data',
 problem='Mapping objects to tables and writing SQL by hand for every query and update.',
 inside='Repository proxy → <code>SimpleJpaRepository</code> → the transaction\'s <code>EntityManager</code> (persistence context = first-level cache of managed entities) → dirty checking at flush → SQL via Hibernate → JDBC.',
 use=code('''
@Entity
public class Payment {
    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE)
    private Long id;

    @Version
    private Long version;                               // optimistic locking

    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    private PaymentStatus status;

    @ManyToOne(fetch = FetchType.LAZY)                  // EAGER by default → make it LAZY
    private Account account;

    @OneToMany(mappedBy = "payment", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<PaymentItem> items = new ArrayList<>(); // LAZY by default
    // constructors, getters, domain methods omitted
}

public interface PaymentRepository extends JpaRepository<Payment, Long> {

    List<Payment> findByStatus(PaymentStatus status);   // derived query, checked at startup

    @EntityGraph(attributePaths = "items")              // load items in the same query → no N+1
    List<Payment> findWithItemsByStatus(PaymentStatus status);
}'''),
 breaks=['<b>N+1</b>: list query + one query per parent when touching a lazy collection.',
         '<code>LazyInitializationException</code>: lazy data touched after the transaction/session closed.',
         'Updates "not saved": method not <code>@Transactional</code> (entity detached) or <code>readOnly = true</code>.',
         '<code>save()</code> on a detached object = merge → returns a different (managed) instance.',
         '<code>@Version</code> conflict → <code>ObjectOptimisticLockingFailureException</code> (map to 409).'],
 breakcode='',
 answer=['JPA maps entities to tables; inside a transaction Hibernate tracks managed entities and writes changes at flush.',
         'The persistence context caches one object per id, keeps snapshots, and at commit dirty-checks them into UPDATEs; lazy associations load on first access while the session is open.',
         'I keep associations LAZY, fetch what a use case needs with @EntityGraph/JOIN FETCH or DTO projections, and turn off open-in-view — that\'s how I avoid N+1 in SecurePay.'],
 check=[('What is the N+1 problem and how do you fix it?','1 query for N rows + N queries for a lazy association; fix with fetch join/@EntityGraph, batch fetching or DTO projections.'),
        ('Why is save() not needed after changing a loaded entity?','It is managed; dirty checking writes the change at flush/commit.'),
        ('What does @Version do?','Adds WHERE version=? to updates; 0 rows updated means a concurrent change → optimistic locking exception.')],
 links=[('jpa',3,'Dirty checking'),('jpa',6,'N+1 and the three fixes'),('jpa',7,'LazyInitializationException'),('jpa',8,'Optimistic locking')]),
# ---------------------------------------------------------------------------
dict(id='security', n=9, title='Spring Security: filter chain & JWT', area='Security',
 problem='Every request must be authenticated (who are you?) and authorized (may you do this?) before business code runs.',
 inside='<code>DelegatingFilterProxy</code> → <code>FilterChainProxy</code> → <code>BearerTokenAuthenticationFilter</code> → <code>JwtAuthenticationProvider</code> → <code>NimbusJwtDecoder</code> (signature via JWKS, exp, iss) → <code>SecurityContextHolder</code> → <code>AuthorizationFilter</code> checks <code>SCOPE_…</code> → DispatcherServlet.',
 use=code('''
@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    SecurityFilterChain api(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())                         // Bearer tokens, no cookies
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/health/**", "/error").permitAll()
                .requestMatchers(HttpMethod.POST, "/payments").hasAuthority("SCOPE_payment.write")
                .requestMatchers(HttpMethod.GET, "/payments/**").hasAuthority("SCOPE_payment.read")
                .anyRequest().authenticated())
            .oauth2ResourceServer(o -> o.jwt(Customizer.withDefaults()));
        return http.build();
    }
}''') + code('''
# application.yml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: http://localhost:9000''', 'yaml'),
 breaks=['Missing/expired/tampered token → <b>401</b>; valid token without the scope → <b>403</b>.',
         'Scopes become <code>SCOPE_x</code> authorities — <code>hasRole</code> won\'t match them.',
         'Browser apps: CORS preflight must be handled by <code>.cors(Customizer.withDefaults())</code> (with a CorsConfigurationSource bean) before authentication.',
         '<code>SecurityContextHolder</code> is ThreadLocal: @Async / other threads lose the user.'],
 breakcode='',
 answer=['Spring Security is a chain of servlet filters in front of MVC that authenticates the caller and checks permissions.',
         'For JWT, BearerTokenAuthenticationFilter hands the token to JwtAuthenticationProvider; NimbusJwtDecoder verifies the signature with cached JWKS keys and exp/iss, scopes become SCOPE_ authorities, and AuthorizationFilter applies my rules.',
         'In SecurePay the Auth Server issues RS256 tokens; Service A and B validate them independently and A relays the same token to B.'],
 check=[('401 vs 403?','401: not authenticated (no/invalid credentials). 403: authenticated but not allowed.'),
        ('Does the resource server call the Auth Server on every request?','No, it verifies the signature offline with the public keys it fetched and cached from the JWKS endpoint.'),
        ('Why disable CSRF for a JWT API?','CSRF abuses cookies the browser sends automatically; Bearer tokens are added by the client explicitly.')],
 links=[('security',7,'JWT accepted (201)'),('security',8,'JWT rejected (401)'),('security',9,'Missing scope (403)'),('security',1,'Form login internals')]),
# ---------------------------------------------------------------------------
dict(id='calls', n=10, title='Service-to-service calls & resilience', area='Microservices',
 problem='Service A must call Service B safely: pass the user\'s token, survive B being slow or down, and never double-charge.',
 inside='<code>WebClient</code> built from Boot\'s builder (tracing, metrics) → <code>ServletBearerExchangeFilterFunction</code> copies the JWT from the SecurityContext (with RestClient you write a small ClientHttpRequestInterceptor) → Resilience4j circuit breaker counts failures → OPEN = fail fast → fallback.',
 use=code('''
@Configuration
class ClientConfig {
    @Bean
    WebClient paymentBClient(WebClient.Builder builder) {        // Boot's builder: observability
        return builder.baseUrl("http://localhost:8081")
                      .filter(new ServletBearerExchangeFilterFunction())   // relay the caller's JWT
                      .build();
    }
}

@Service
class PaymentBClient {
    private final WebClient client;
    // constructor omitted

    @CircuitBreaker(name = "serviceB", fallbackMethod = "unavailable")   // resilience4j-spring-boot3
    public PaymentDto create(CreatePayment req) {
        return client.post().uri("/payments").bodyValue(req)
                     .retrieve().bodyToMono(PaymentDto.class)
                     .block(Duration.ofSeconds(3));                      // always set a timeout
    }

    // narrow type: runs only when the breaker is OPEN; B's 4xx still propagate
    PaymentDto unavailable(CreatePayment req, CallNotPermittedException ex) {
        throw new PaymentServiceUnavailableException(ex);                // → 503, never fake success
    }
}'''),
 breaks=['No timeout → threads pile up waiting for a slow B.',
         'Retrying a POST can create a duplicate payment → use an <b>Idempotency-Key</b>.',
         'Work moved to another thread (ThreadPoolBulkhead / TimeLimiter, @Async) loses SecurityContext → no token relayed → B returns 401.',
         'A fallback taking <code>Throwable</code> catches everything, including B\'s 4xx → narrow the type, and list 4xx in <code>ignore-exceptions</code> so they don\'t open the breaker.',
         'B\'s 404/409 turned into a generic 500 in A unless you map errors deliberately.'],
 breakcode='',
 answer=['A calls B over HTTP with the user\'s JWT, with timeouts and a circuit breaker so B\'s problems don\'t take A down.',
         'The bearer exchange filter copies the token from the SecurityContext; the circuit breaker opens when the failure rate crosses the threshold and calls fail fast into a fallback.',
         'For payments I only retry idempotent calls or use an idempotency key, and I pass B\'s errors through as proper 4xx/503 responses.'],
 check=[('Token relay vs client credentials?','Relay forwards the user\'s token (B knows the user); client credentials uses the service\'s own token (machine identity).'),
        ('Circuit breaker states?','CLOSED → OPEN when the failure rate exceeds the threshold → HALF_OPEN trial calls → CLOSED or OPEN.'),
        ('Why is retrying POST /payments dangerous?','The first attempt may have succeeded; a retry creates a second payment unless the server deduplicates by an idempotency key.')],
 links=[('security',15,'Token relay A → B'),('cloud',5,'Circuit breaker'),('cloud',6,'Retry + idempotency')]),
# ---------------------------------------------------------------------------
dict(id='kafka', n=11, title='Kafka with Spring', area='Messaging',
 problem='Other services (notifications, reporting) must react to payments without A waiting for them.',
 inside='<code>KafkaTemplate.send</code> → partition by key (ordering) → broker ack (<code>acks=all</code>) … <code>@KafkaListener</code> container polls → your method → offset commit. Delivery is <b>at least once</b>.',
 use=code('''
@Service
class PaymentEventPublisher {
    private static final Logger log = LoggerFactory.getLogger(PaymentEventPublisher.class);
    private final KafkaTemplate<String, PaymentCreated> kafka;
    // constructor omitted

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)   // only after the DB commit
    void on(PaymentCreated event) {
        kafka.send("payments.events", event.paymentId().toString(), event)   // key → partition → order
             .whenComplete((result, ex) -> {
                 if (ex != null) log.error("send failed for {}", event.paymentId(), ex);
             });
    }
}

@Component
class NotificationListener {
    private final ProcessedEvents processed;   // table with a unique event_id
    private final Mailer mailer;
    // constructor omitted

    @KafkaListener(id = "notifications", topics = "payments.events")
    void on(PaymentCreated event) {
        if (!processed.markIfNew(event.eventId())) return;   // duplicate delivery → skip
        mailer.sendReceipt(event);
    }
}

@Bean
DefaultErrorHandler errorHandler(KafkaTemplate<Object, Object> template) {
    return new DefaultErrorHandler(new DeadLetterPublishingRecoverer(template),
                                   new FixedBackOff(1000L, 3));   // 3 retries, then payments.events-dlt
}'''),
 breaks=['Sending inside the DB transaction → "ghost" events if the commit fails; after commit can lose events on a crash → <b>outbox pattern</b> for reliability.',
         'Consumers see duplicates (rebalance, crash before offset commit) → make them idempotent.',
         'Ordering is only per partition — choose the key deliberately.',
         'No config: DefaultErrorHandler retries 9 times with no delay, then logs and skips the record (data lost). A deserialization failure without <code>ErrorHandlingDeserializer</code> can loop forever.',
         '<code>@TransactionalEventListener</code> is silently skipped when no transaction is active (unless <code>fallbackExecution = true</code>).'],
 breakcode='',
 answer=['Kafka decouples services: A publishes PaymentCreated, other services consume it at their own pace.',
         'The producer picks a partition from the key and waits for acks=all; listener containers poll, call my method and commit offsets after processing — so delivery is at least once.',
         'I publish after commit (or via an outbox), keep consumers idempotent with an event id, and send failures to a dead-letter topic.'],
 check=[('What guarantees ordering in Kafka?','Only within a partition; records with the same key go to the same partition.'),
        ('Why must consumers be idempotent?','At-least-once delivery: a crash or rebalance before the offset commit replays records.'),
        ('What is the dual-write problem?','DB commit and Kafka send are separate systems; one can succeed while the other fails. The outbox pattern fixes it.')],
 links=[('kafka',1,'Publish: send → partition → ack'),('kafka',2,'Dual write & outbox'),('kafka',4,'Retries → DLT'),('kafka',5,'Duplicates & rebalance')]),
]

METHOD = '''
<section class="card" id="method">
 <h2>How to learn each feature</h2>
 <p>Ask the same <b>four questions</b> for every Spring feature. Most people can answer 1 and 3; interviews are decided by 2 and 4.</p>
 <ol class="q4">
  <li><b>Problem</b> — what pain does it remove?</li>
  <li><b>Inside</b> — which 3–5 classes do the work, in what order?</li>
  <li><b>Use</b> — what annotation, bean or property do you write?</li>
  <li><b>Breaks</b> — where does it fail or surprise people?</li>
 </ol>
 <h3>The loop (one topic every 2–3 days)</h3>
 <table>
  <tr><th>Step</th><th>Where</th><th>Time</th></tr>
  <tr><td>Read the flow</td><td>Explorer scenario with <b>Guess mode</b> + <b>Hide unseen boxes</b></td><td>30 min</td></tr>
  <tr><td>See it for real</td><td>Your SecurePay project: breakpoint, TRACE log, break it on purpose</td><td>30 min</td></tr>
  <tr><td>Say it out loud</td><td>Answer the 4 questions without looking, then check this page</td><td>10 min</td></tr>
  <tr><td>Write it down</td><td>One interview line + one gotcha in your notebook</td><td>5 min</td></tr>
 </table>
 <h3>Answer in three layers (~60 seconds)</h3>
 <ol><li><b>One line</b> — what it does.</li><li><b>Mechanism</b> — the classes, in order.</li><li><b>Gotcha + your project</b> — "In SecurePay I…"</li></ol>
 <h3>Avoid</h3>
 <ul><li>Clicking through many scenarios passively.</li><li>Memorising annotation or version lists without the "breaks" part.</li><li>Kafka / Cloud / Kubernetes before transactions and JPA are solid.</li></ul>
</section>'''

VERSIONS = '''
<section class="card" id="versions">
 <h2>Versions — only after the concepts</h2>
 <table>
  <tr><th>Version</th><th>Remember</th></tr>
  <tr><td>Spring 2.5</td><td>Annotations: @Component, @Autowired</td></tr>
  <tr><td>Spring 3</td><td>Java config: @Configuration, @Bean</td></tr>
  <tr><td>Spring 4</td><td>@RestController, Java 8</td></tr>
  <tr><td>Spring 5 / Boot 2</td><td>WebFlux (reactive)</td></tr>
  <tr><td>Spring 6 / Boot 3</td><td>Java 17 baseline, <code>javax</code> → <code>jakarta</code>, ProblemDetail, observability</td></tr>
  <tr><td>Spring 7 / Boot 4</td><td>Nov 2025: Jakarta EE 11, JSpecify null-safety, API versioning, built-in @Retryable / @ConcurrencyLimit, Jackson 3; Java 17 baseline kept</td></tr>
 </table>
</section>'''

def card(t):
    links = ''.join('<a class="go" href="index.html#%s/%d/1">▶ %s</a>' % (tp, sc, html.escape(lbl)) for tp, sc, lbl in t['links'])
    breaks = '<ul>' + ''.join('<li>%s</li>' % b for b in t['breaks']) + '</ul>' + t['breakcode']
    answer = '<ol class="ans">' + ''.join('<li>%s</li>' % a for a in t['answer']) + '</ol>'
    check = ''.join('<details class="chk"><summary>%s</summary><p>%s</p></details>' % (html.escape(q), html.escape(a)) for q, a in t['check'])
    return f'''
<section class="card topic" id="{t['id']}">
 <div class="hd"><span class="num">{t['n']}</span><div><h2>{t['title']}</h2><div class="area">{t['area']}</div></div></div>
 <div class="q"><h3>1 · Problem</h3><p>{t['problem']}</p></div>
 <div class="q"><h3>2 · Inside</h3><p>{t['inside']}</p></div>
 <div class="q"><h3>3 · Use</h3>{t['use']}</div>
 <div class="q"><h3>4 · Breaks</h3>{breaks}</div>
 <div class="q"><h3>60-second answer</h3>{answer}</div>
 <div class="q"><h3>Check yourself</h3>{check}</div>
 <div class="links">{links}</div>
</section>'''

toc = ''.join('<li><a href="#%s">%s</a> <span class="area">%s</span></li>' % (t['id'], t['title'], t['area']) for t in TOPICS)

page = '''<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Spring Interview Study Guide</title>
<style>
:root{color-scheme:dark;--bg:#000;--ink:#fff;--muted:#a3a3a3;--faint:#6b6b6b;--line:#2a2a2a;--panel:#0c0e11;--active:#f0a35c;--link:#5cc8f0;--add:#5fd38d}
html{background:var(--bg);scroll-padding-top:90px}
body{background:var(--bg);color:var(--ink);font:15px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;margin:0}
a{color:var(--link)}
.top{position:sticky;top:0;z-index:5;background:rgba(0,0,0,.94);border-bottom:1px solid var(--line);padding:10px 16px;display:flex;gap:14px;flex-wrap:wrap;align-items:center}
.top b{margin-right:auto}
.top a{text-decoration:none;font-size:14px}
.wrap{max-width:900px;margin:0 auto;padding:16px 16px 60px;display:grid;gap:16px}
.wrap>*{min-width:0}
h1{margin:6px 0 0;font-size:26px}
.sub{color:var(--muted);margin:4px 0 0}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px 18px;display:grid;gap:10px}
.card h2{margin:0;font-size:20px}
.card h3{margin:4px 0 0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--active)}
.card p{margin:0}
.card>*,.q>*{min-width:0}
.q{min-width:0;display:grid;gap:8px}
p code,li code,td code{overflow-wrap:anywhere}
.card ul,.card ol{margin:0;padding-left:20px;display:grid;gap:4px}
.hd{display:flex;gap:12px;align-items:center}
.num{flex:0 0 auto;width:32px;height:32px;border-radius:50%;background:var(--active);color:#000;font-weight:700;display:grid;place-items:center}
.area{color:var(--faint);font-size:13px}
.toc{columns:2;column-gap:28px;padding-left:20px;margin:0}
.toc li{break-inside:avoid;margin-bottom:4px}
@media (max-width:640px){.toc{columns:1}}
table{border-collapse:collapse;width:100%;font-size:14px}
th,td{text-align:left;border-bottom:1px solid var(--line);padding:6px 8px;vertical-align:top}
th{color:var(--muted);font-weight:600}
code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.9em;color:#e6d3b8}
pre.code{margin:0;background:#050608;border:1px solid var(--line);border-radius:8px;padding:12px;overflow-x:auto;font:12.5px/1.55 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#e8e8e8}
pre.code code{color:inherit;font-size:inherit}
pre.code .c{color:#7d8b99}
pre.code .a{color:#f2c14e}
.ans li{padding-left:2px}
.chk{border:1px solid var(--line);border-radius:8px;padding:8px 10px;background:#0a0c0f}
.chk summary{cursor:pointer;font-weight:600}
.chk p{margin-top:6px;color:#cfe9d9}
.links{display:flex;flex-wrap:wrap;gap:8px}
.go{display:inline-block;border:1px solid #3a414b;border-radius:6px;padding:6px 10px;text-decoration:none;font-size:13.5px;background:#15181d;color:var(--ink)}
.go:hover{border-color:var(--active)}
</style>
<nav class="top"><b>Spring Interview Study Guide</b><a href="index.html">Explorer</a><a href="dev.html">Build it</a><a href="#method">Method</a><a href="#versions">Versions</a></nav>
<main class="wrap">
 <header><h1>Learn Spring for interviews</h1><p class="sub">Concept first, versions last. For each feature: problem → inside → use → breaks, then say it in 60 seconds and check yourself. Buttons open the matching explorer scenario.</p></header>
''' + METHOD + '''
 <section class="card"><h2>Order</h2><ol class="toc">''' + toc + '''</ol><p class="area">Topics 1–8 cover most Spring interview questions. Do them before 9–11.</p></section>
''' + ''.join(card(t) for t in TOPICS) + VERSIONS + '''
</main>
'''
open(OUT, 'w').write(page)
print('learn.html written:', OUT, len(page))
