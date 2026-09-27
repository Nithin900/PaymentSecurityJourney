"""Builds dev.html: the developer point-of-view page ("Build it").
For each concept: generalized questions you ask when starting a feature -> the SecurePay answer
-> what you build (you write / you configure / Spring gives it). Then the classes list.
Usage: python3 build_dev.py [OUT]"""
import html, os, sys

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../site/dev.html')

# kind: w = you write a class, c = you configure (yml / @Bean / DSL line / dependency), s = Spring does it (nothing to write)
TOPICS = [
dict(id='di', title='Beans & dependency injection', area='Spring Core',
 links=[('core', 3, 'Injection: which bean?'), ('core', 4, 'Circular dependency')],
 qs=[
  ('Which classes hold business logic or talk to other systems?',
   'Payment rules, refunds, the Service B client, the event publisher.',
   '<code>@Service</code> / <code>@Component</code> classes with <b>constructor injection</b> (final fields, one constructor, no <code>@Autowired</code> needed).', 'w'),
  ('Which objects come from a library, so I can\'t put an annotation on them?',
   '<code>Clock</code> (for testable time), a configured <code>WebClient</code>.',
   '<code>@Configuration</code> class (e.g. <code>AppConfig</code>) with <code>@Bean</code> methods.', 'w'),
  ('Is there more than one implementation of the same interface?',
   '<code>FraudCheck</code>: real rules in prod, a no-op locally.',
   '<code>@Profile("local")</code> or <code>@ConditionalOnProperty</code> to choose one; <code>@Primary</code> / <code>@Qualifier</code> if both must exist.', 'c'),
  ('Does any bean keep data that changes per request or per user?',
   'No. Request data travels as method parameters; beans are singletons shared by all threads.',
   'Keep beans stateless (no mutable fields). Only if really needed: request scope or <code>ObjectProvider</code>.', 's'),
  ('Do two services need each other?',
   '<code>PaymentService</code> ↔ <code>RefundService</code> would be circular.',
   'Move the shared logic into a third class, or publish an event. Don\'t hide it with <code>@Lazy</code>.', 'w'),
  ('Can I unit-test the class without starting Spring?',
   'Yes, because of constructor injection.',
   '<code>new PaymentService(mockRepo, Clock.fixed(...))</code> in a plain JUnit + Mockito test.', 'w'),
 ],
 write=['service/PaymentService, RefundService', 'config/AppConfig (@Bean Clock, clients)', 'one implementation per profile where needed', 'unit tests with constructor injection'],
 spring=['ApplicationContext / DefaultListableBeanFactory', 'component scanning from the @SpringBootApplication package', 'AutowiredAnnotationBeanPostProcessor (injection)']),

dict(id='lifecycle', title='Bean lifecycle (startup & shutdown)', area='Spring Core',
 links=[('core', 2, 'One bean\'s full lifecycle'), ('core', 18, 'Scopes: prototype & request bean')],
 qs=[
  ('Does something need to be loaded or warmed up once at startup?',
   'Fee table / currency list cached in memory.',
   '<code>@PostConstruct</code> for simple setup inside the bean. If it needs transactions or other fully-ready beans: <code>@EventListener(ApplicationReadyEvent.class)</code> or an <code>ApplicationRunner</code> (@PostConstruct runs before the proxy exists).', 'w'),
  ('Should the app refuse to start if a setting is missing or wrong?',
   'Yes: no Service B URL or no issuer-uri = broken service.',
   '<code>@Validated</code> <code>@ConfigurationProperties</code> with <code>@NotNull</code> / <code>@NotBlank</code> → startup fails fast.', 'c'),
  ('Is there something to close or finish on shutdown?',
   'An executor, in-flight requests.',
   '<code>@PreDestroy</code> or <code>@Bean(destroyMethod = ...)</code>. Graceful shutdown for the web server is on by default since Boot 3.4 (<code>server.shutdown</code>).', 'c'),
  ('Do I need a new object each time instead of one shared bean?',
   'A stateful report/batch builder.',
   'Usually just <code>new</code> it. If it must be a bean: prototype scope + <code>ObjectProvider&lt;T&gt;.getObject()</code>.', 'w'),
  ('Do I need to change or wrap every bean as it is created?',
   'No, not in SecurePay.',
   'That is a <code>BeanPostProcessor</code> — framework territory; application code almost never needs one.', 's'),
 ],
 write=['@PostConstruct / ApplicationReadyEvent listener for warm-up', '@PreDestroy where you own a resource', 'validated @ConfigurationProperties'],
 spring=['instantiate → inject → Aware → BPP before-init (@PostConstruct) → init → BPP after-init (proxies)', 'context close hook, graceful shutdown']),

dict(id='aop', title='AOP (cross-cutting logic)', area='Spring Core',
 links=[('core', 5, 'Proxy creation'), ('core', 10, 'Self-invocation'), ('core', 14, 'Your own @Aspect')],
 qs=[
  ('Is the same extra logic repeated around many methods?',
   'Timing + audit log around every money-moving method.',
   'An <code>@Aspect @Component</code> class (e.g. <code>AuditAspect</code>) with <code>@Around</code>.', 'w'),
  ('Is it about HTTP requests or about Java methods?',
   'Correlation id per request = HTTP. Audit per business method = method.',
   'HTTP → <code>OncePerRequestFilter</code> / <code>HandlerInterceptor</code>. Method → aspect.', 'w'),
  ('How do I choose exactly which methods?',
   'Only methods marked as auditable.',
   'Own annotation <code>@Audited</code> + pointcut <code>@Around("@annotation(audited)")</code>.', 'w'),
  ('Is it already solved by Spring?',
   'Timing/metrics: yes.',
   'Micrometer <code>@Observed</code> / <code>@Timed</code> (enable with <code>management.observations.annotations.enabled=true</code>) instead of a hand-written timing aspect.', 'c'),
  ('Must it run before or after @Transactional / security?',
   'Audit should wrap the transaction.',
   '<code>@Order</code> on the aspect: lower value = outer (runs first).', 'c'),
  ('Is the method public and called from another bean?',
   'A call via <code>this.method()</code> inside the same class is not advised.',
   'Call it through another bean. Keep advised methods public.', 's'),
 ],
 write=['aop/AuditAspect (@Aspect @Component)', 'annotation/Audited', 'web/CorrelationIdFilter (HTTP-level)'],
 spring=['AnnotationAwareAspectJAutoProxyCreator → CGLIB proxy', 'spring-boot-starter-aop (aspectjweaver) turns it on']),

dict(id='tx', title='@Transactional', area='Spring Core',
 links=[('core', 7, '@Transactional call: commit'), ('core', 9, 'Checked exception still commits'), ('core', 12, 'REQUIRES_NEW')],
 qs=[
  ('Which database writes must all succeed or all fail?',
   'Refund: insert the Refund row + change Payment status.',
   '<code>@Transactional</code> on the public service method (<code>RefundService.refund</code>), not on the controller or repository.', 'w'),
  ('Is this method only reading?',
   'GET payment, list payments.',
   '<code>@Transactional(readOnly = true)</code> (Hibernate skips dirty checking; lazy fields load inside).', 'c'),
  ('Which exceptions should roll back?',
   'Business failures like "refund exceeds amount".',
   'Make them <code>RuntimeException</code>s, or <code>rollbackFor = Exception.class</code> — checked exceptions commit by default.', 'w'),
  ('Must something be saved even if the main work rolls back?',
   'Audit row "refund attempt failed".',
   'Separate bean <code>AuditService</code> with <code>@Transactional(propagation = REQUIRES_NEW)</code>.', 'w'),
  ('Does the transaction call a slow external system?',
   'Calling Service B / a gateway would hold the DB connection.',
   'Call it outside the transaction, or split: tx1 save PENDING → call → tx2 update.', 'w'),
  ('Can two requests change the same row at once?',
   'Two refunds of the same payment.',
   '<code>@Version</code> on the entity (optimistic lock) → 409 on conflict. See JPA.', 'w'),
  ('Does something happen only after the commit?',
   'Publish PaymentRefunded to Kafka.',
   '<code>@TransactionalEventListener(phase = AFTER_COMMIT)</code>, or an outbox table for guaranteed delivery.', 'w'),
 ],
 write=['service/RefundService (@Transactional)', 'service/AuditService (REQUIRES_NEW)', 'exception classes extending RuntimeException'],
 spring=['TransactionInterceptor (proxy)', 'JpaTransactionManager (auto-configured)', 'TransactionSynchronizationManager (connection bound to the thread)']),

dict(id='boot', title='Spring Boot: starters & configuration', area='Spring Boot',
 links=[('boot', 4, 'How a DataSource appears'), ('boot', 5, 'Your bean replaces Boot\'s default')],
 qs=[
  ('Which capabilities does this service need?',
   'REST API, JPA, JWT security, validation, health.',
   'Starters in pom.xml: <code>web</code>, <code>data-jpa</code>, <code>oauth2-resource-server</code>, <code>validation</code>, <code>actuator</code> + DB driver.', 'c'),
  ('Which values change per environment?',
   'DB URL, issuer-uri, Service B URL, timeouts.',
   '<code>application.yml</code> + <code>application-local.yml</code> / profiles; secrets from environment variables, never committed.', 'c'),
  ('Do I have my own settings?',
   '<code>securepay.service-b.base-url</code>, <code>securepay.service-b.timeout</code>.',
   '<code>@ConfigurationProperties("securepay")</code> record (e.g. <code>SecurePayProperties</code>) + <code>@ConfigurationPropertiesScan</code>.', 'w'),
  ('Is Boot\'s default bean good enough?',
   'JSON should skip nulls.',
   'Change it with a property (<code>spring.jackson.default-property-inclusion=non_null</code>) or a customizer bean. Defining your own <code>ObjectMapper</code> makes Boot back off completely.', 'c'),
  ('Why is (or isn\'t) something auto-configured?',
   'DataSource not created in a test.',
   'Run with <code>--debug</code> (conditions report) or <code>/actuator/conditions</code>.', 's'),
 ],
 write=['config/SecurePayProperties (record)', 'application.yml + profile files', 'customizer beans only where a property is not enough'],
 spring=['SpringApplication.run, embedded Tomcat', 'auto-configurations from AutoConfiguration.imports', '@ConditionalOnMissingBean back-off']),

dict(id='mvc', title='REST API (Spring MVC)', area='Spring MVC',
 links=[('journey', 1, 'Full request journey'), ('mvc', 2, 'GET full doDispatch'), ('mvc', 3, 'POST @RequestBody + @Valid')],
 qs=[
  ('What URL, HTTP method and status codes?',
   '<code>POST /payments</code> → 201 + Location; <code>GET /payments/{id}</code> → 200 / 404.',
   '<code>PaymentController</code>: <code>@RestController</code>, <code>@RequestMapping("/payments")</code>, <code>ResponseEntity.created(uri)</code>.', 'w'),
  ('What does the client send, and what is valid?',
   'amount &gt; 0, 3-letter currency, merchantReference.',
   '<code>CreatePaymentRequest</code> record with <code>@NotNull</code>, <code>@Positive</code>, <code>@Pattern</code>; <code>@Valid @RequestBody</code>.', 'w'),
  ('What do I send back?',
   'id, status, amount, createdAt — never the entity.',
   '<code>PaymentResponse</code> record + a small <code>PaymentMapper</code>.', 'w'),
  ('Any path variables, query params, headers?',
   'id, page/size/status filter, <code>Idempotency-Key</code>.',
   '<code>@PathVariable</code>, <code>@RequestParam</code> / <code>Pageable</code>, <code>@RequestHeader("Idempotency-Key")</code>.', 'w'),
  ('Does it return a list that can grow?',
   'Payments of a merchant: page it.',
   '<code>Pageable</code> in, a DTO page out (or <code>@EnableSpringDataWebSupport(pageSerializationMode = VIA_DTO)</code>) — returning <code>Page&lt;T&gt;</code> directly logs a warning.', 'c'),
  ('Where does the logic go?',
   'Controller only translates HTTP ↔ Java.',
   'Controller calls one service method; rules live in <code>PaymentService</code>.', 'w'),
  ('Is anything needed for every request?',
   'Correlation id header, request logging.',
   '<code>OncePerRequestFilter</code> (before Spring MVC) or <code>HandlerInterceptor</code> (around the handler).', 'w'),
  ('How do I test only the web layer?',
   'Status codes, JSON shape, validation errors.',
   '<code>@WebMvcTest(PaymentController.class)</code> + <code>MockMvc</code> + <code>@MockitoBean PaymentService</code>.', 'w'),
 ],
 write=['web/PaymentController', 'web/dto/CreatePaymentRequest, PaymentResponse', 'web/PaymentMapper', 'web/CorrelationIdFilter (optional)', 'PaymentControllerTest'],
 spring=['DispatcherServlet, RequestMappingHandlerMapping / Adapter', 'Jackson message converter (JSON ↔ records)', 'Bean Validation (Hibernate Validator)']),

dict(id='errors', title='Error handling', area='Spring MVC',
 links=[('mvc', 6, 'Business exception → ProblemDetail'), ('mvc', 7, '500 → /error and the Security trap'), ('journey', 2, 'Validation fails → 400')],
 qs=[
  ('What business failures can happen?',
   'Payment not found, already refunded, refund too large.',
   'Own exceptions: <code>PaymentNotFoundException</code>, <code>RefundNotAllowedException</code> (extend RuntimeException).', 'w'),
  ('Which status code for each?',
   '404, 409, 422.',
   '<code>GlobalErrorHandler</code>: <code>@RestControllerAdvice</code> with <code>@ExceptionHandler</code> methods returning <code>ProblemDetail</code>.', 'w'),
  ('What JSON shape do clients get?',
   'RFC 9457 ProblemDetail for everything.',
   'Extend <code>ResponseEntityExceptionHandler</code> (or <code>spring.mvc.problemdetails.enabled=true</code>) so Spring\'s own errors use the same shape.', 'c'),
  ('What about invalid input?',
   '<code>@Valid</code> fails → 400 with field errors.',
   'Override <code>handleMethodArgumentNotValid</code> to add the field list.', 'w'),
  ('What about unexpected errors?',
   '500, no stack trace to the client, full log with traceId.',
   'A catch-all <code>@ExceptionHandler(Exception.class)</code> that logs and returns a generic ProblemDetail — plus an <code>@ExceptionHandler(AccessDeniedException.class)</code> that returns 403, because <code>@PreAuthorize</code> denials pass through the advice.', 'w'),
  ('What about 401/403?',
   'URL rules fail in the security filter chain, before the controller.',
   'Not the advice — Security\'s <code>AuthenticationEntryPoint</code> / <code>AccessDeniedHandler</code>. Keep <code>/error</code> permitted.', 'c'),
 ],
 write=['exception/PaymentNotFoundException, RefundNotAllowedException', 'web/GlobalErrorHandler (@RestControllerAdvice)'],
 spring=['ExceptionHandlerExceptionResolver', 'DefaultHandlerExceptionResolver (415, 405…)', 'BasicErrorController (/error)']),

dict(id='jpa', title='Database (Spring Data JPA)', area='Spring Data JPA',
 links=[('jpa', 3, 'Dirty checking'), ('jpa', 6, 'N+1 and the three fixes'), ('jpa', 8, 'Optimistic locking')],
 qs=[
  ('What do I store and what identifies it?',
   'Payment: id, amount, currency, status, merchantId, createdAt.',
   '<code>@Entity Payment</code>: <code>BigDecimal</code> amount, <code>@Enumerated(EnumType.STRING)</code> status, generated id.', 'w'),
  ('How are the tables related?',
   'One payment has many refunds.',
   '<code>Refund</code> with <code>@ManyToOne(fetch = LAZY)</code>; <code>Payment</code> with <code>@OneToMany(mappedBy = "payment")</code>.', 'w'),
  ('Which queries do I need?',
   'By id, by merchant + status with paging.',
   '<code>PaymentRepository extends JpaRepository&lt;Payment, Long&gt;</code>; <code>findByMerchantIdAndStatus(..., Pageable)</code>; <code>@Query</code> for complex ones.', 'w'),
  ('What must be loaded together?',
   'Payment detail shows its refunds.',
   '<code>@EntityGraph(attributePaths = "refunds")</code> or <code>JOIN FETCH</code> — avoid N+1.', 'w'),
  ('Can two users change the same row?',
   'Two refunds at once.',
   '<code>@Version Long version</code> → <code>OptimisticLockingFailureException</code> → map to 409.', 'w'),
  ('What must be unique?',
   'Idempotency key per merchant.',
   'A unique constraint in the database (not only a check in Java).', 'w'),
  ('Who creates the tables?',
   'Versioned scripts, same in every environment.',
   'Flyway: <code>V1__create_payment.sql</code>; <code>spring.jpa.hibernate.ddl-auto=validate</code> (Postgres also needs <code>flyway-database-postgresql</code>).', 'c'),
  ('Should lazy loading happen while writing the JSON response?',
   'No — load what you need in the service.',
   '<code>spring.jpa.open-in-view=false</code> (default true, logs a warning, hides N+1).', 'c'),
  ('How do I test queries?',
   'Against a real Postgres.',
   '<code>@DataJpaTest</code> + Testcontainers (<code>@ServiceConnection</code>).', 'w'),
 ],
 write=['domain/Payment, Refund (@Entity)', 'repository/PaymentRepository, RefundRepository', 'db/migration/V1__…sql', 'PaymentRepositoryTest'],
 spring=['SimpleJpaRepository (the implementation of your interface)', 'EntityManager / persistence context, dirty checking', 'HikariCP DataSource']),

dict(id='security', title='Security (JWT resource server)', area='Spring Security',
 links=[('security', 7, 'JWT accepted (201)'), ('security', 8, 'JWT rejected (401)'), ('security', 9, 'Missing scope (403)')],
 qs=[
  ('Who calls this service, and how do they prove who they are?',
   'Clients and Service A, with a JWT from the Auth Server :9000.',
   '<code>spring-boot-starter-oauth2-resource-server</code> + <code>spring.security.oauth2.resourceserver.jwt.issuer-uri</code>.', 'c'),
  ('Which endpoints are open without a token?',
   '<code>/actuator/health/**</code>, <code>/error</code>.',
   '<code>SecurityConfig</code> with a <code>SecurityFilterChain</code> bean, <code>permitAll()</code> for those.', 'w'),
  ('Who can do what?',
   'POST needs <code>payments.write</code>, GET needs <code>payments.read</code>.',
   '<code>hasAuthority("SCOPE_payments.write")</code> rules, or <code>@EnableMethodSecurity</code> + <code>@PreAuthorize</code>.', 'c'),
  ('Do I need the caller\'s identity in my code?',
   'merchantId / <code>sub</code> from the token.',
   '<code>@AuthenticationPrincipal Jwt jwt</code> in the controller; a <code>JwtAuthenticationConverter</code> bean if roles come from a custom claim.', 'w'),
  ('Stateful or stateless?',
   'Stateless API.',
   '<code>SessionCreationPolicy.STATELESS</code>, CSRF off (no cookies).', 'c'),
  ('What does the client see on 401 / 403?',
   'Default is fine; JSON body optional.',
   'Custom <code>AuthenticationEntryPoint</code> / <code>AccessDeniedHandler</code> only if you want ProblemDetail.', 'c'),
  ('Can user A see user B\'s payment?',
   'Must not — most people forget this.',
   'Ownership check in <code>PaymentService</code>: token merchantId vs payment.merchantId → 404/403. The filter chain can\'t do this.', 'w'),
  ('How do I prove it works?',
   'No token 401, wrong scope 403, correct 201.',
   '<code>@WebMvcTest</code> + <code>@Import(SecurityConfig.class)</code> + <code>jwt()</code> request post-processor (the slice does not load your SecurityConfig by itself).', 'w'),
 ],
 write=['config/SecurityConfig (SecurityFilterChain)', 'ownership check in PaymentService', '@AuthenticationPrincipal Jwt in controllers', 'PaymentControllerSecurityTest'],
 spring=['BearerTokenAuthenticationFilter', 'JwtDecoder (from issuer-uri, keys from JWKS)', 'JwtAuthenticationProvider, ExceptionTranslationFilter, AuthorizationFilter']),

dict(id='calls', title='Calling another service (A → B)', area='Spring Cloud / WebClient',
 links=[('security', 15, 'Token relay A → B'), ('cloud', 5, 'Circuit breaker'), ('cloud', 6, 'Retry + idempotency')],
 qs=[
  ('Which remote calls does the feature make?',
   'A calls B <code>POST /payments</code>.',
   'One client class per remote service: <code>ServiceBClient</code> (or an <code>@HttpExchange</code> interface).', 'w'),
  ('Where do the URL and timeouts come from?',
   'Config, different per environment.',
   'Properties + a client <code>@Bean</code> built from Boot\'s <code>WebClient.Builder</code> / <code>RestClient.Builder</code> (keeps tracing and metrics).', 'c'),
  ('Whose identity goes to B?',
   'The user\'s JWT (relay).',
   'Relay: <code>ServletBearerExchangeFilterFunction</code>. Service\'s own identity: OAuth2 client + client_credentials.', 'c'),
  ('What if B is slow or down?',
   'Fail fast with 503, don\'t hang threads.',
   'Timeout + <code>@CircuitBreaker(name = "serviceB", fallbackMethod = ...)</code> (Resilience4j) with a narrow fallback. Needs <code>resilience4j-spring-boot3</code> + <code>spring-boot-starter-aop</code>.', 'c'),
  ('Is it safe to retry?',
   'POST could create a duplicate payment.',
   'Send an <code>Idempotency-Key</code>; B stores it with a unique constraint; retry only safe failures.', 'w'),
  ('How do B\'s errors become A\'s response?',
   'B 404 → A 404, B down → A 503.',
   '<code>onStatus(...)</code> in the client → your exceptions → <code>GlobalErrorHandler</code>.', 'w'),
  ('How do I test without B running?',
   'Fake B.',
   'WireMock or OkHttp <code>MockWebServer</code>.', 'w'),
 ],
 write=['client/ServiceBClient', 'config/ClientConfig (@Bean WebClient)', 'client exceptions + mapping', 'ServiceBClientTest (WireMock)'],
 spring=['WebClient / RestClient + Boot builder (observation, codecs)', 'Resilience4j auto-config (resilience4j-spring-boot3)', 'LoadBalancer if you use Eureka service names']),

dict(id='kafka', title='Events (Kafka)', area='Spring for Apache Kafka',
 links=[('kafka', 1, 'Publish: send → partition → ack'), ('kafka', 2, 'Dual write & outbox'), ('kafka', 4, 'Retries → DLT')],
 qs=[
  ('Who else needs to know when this happens?',
   'Notifications and ledger need "payment created/refunded".',
   'Event record <code>PaymentCreatedEvent</code> + <code>PaymentEventPublisher</code> using <code>KafkaTemplate</code>.', 'w'),
  ('Which topic and which key?',
   '<code>payments.events</code>, key = paymentId (order per payment).',
   'Constant for the name; <code>NewTopic</code> bean (<code>TopicBuilder</code>) for local dev.', 'c'),
  ('When do I send, relative to the DB commit?',
   'Only after the payment is really saved.',
   '<code>@TransactionalEventListener</code> (phase defaults to <code>AFTER_COMMIT</code>); if losing an event is not OK → outbox table + relay.', 'w'),
  ('What if a consumer gets the same event twice?',
   'At-least-once delivery: it will happen.',
   'Idempotent consumer: processed-event id table with a unique key.', 'w'),
  ('What if processing keeps failing?',
   'Retry a few times, then park it.',
   '<code>DefaultErrorHandler</code> + <code>DeadLetterPublishingRecoverer</code> + <code>FixedBackOff</code> → <code>payments.events-dlt</code>.', 'c'),
  ('How are events serialized?',
   'JSON.',
   '<code>JsonSerializer</code> / <code>JsonDeserializer</code> (trusted packages) wrapped in <code>ErrorHandlingDeserializer</code>.', 'c'),
  ('How do I test it?',
   'Real broker in the test.',
   'Testcontainers Kafka (<code>@ServiceConnection</code>) or <code>@EmbeddedKafka</code>.', 'w'),
 ],
 write=['event/PaymentCreatedEvent (record)', 'event/PaymentEventPublisher', 'consumer/NotificationListener (@KafkaListener)', 'config/KafkaErrorConfig (DefaultErrorHandler bean)'],
 spring=['KafkaTemplate, ProducerFactory / ConsumerFactory (auto-config from spring.kafka.*)', 'listener container, offset commits', 'DLT publishing']),

dict(id='obs', title='Observability (health, metrics, traces, logs)', area='Micrometer / Actuator',
 links=[('obs', 1, 'One trace across services'), ('obs', 3, 'Business metrics and @Observed'), ('obs', 6, 'Setup')],
 qs=[
  ('How do we know the service is alive and ready?',
   'Kubernetes / load balancer probes.',
   'Actuator health: <code>/actuator/health/liveness</code> and <code>/readiness</code> (automatic on Kubernetes; elsewhere <code>management.endpoint.health.probes.enabled=true</code>). DB is in overall health; add it to readiness only on purpose (<code>management.endpoint.health.group.readiness.include=readinessState,db</code>), never to liveness.', 'c'),
  ('Which endpoints are exposed?',
   'health, info, prometheus — not everything.',
   '<code>management.endpoints.web.exposure.include=health,info,prometheus</code>.', 'c'),
  ('Who can reach actuator?',
   'Health for probes; the rest only internally.',
   'Expose only what you need; consider <code>management.server.port</code>; <code>show-details</code> stays <code>never</code> (default) on the public side.', 'c'),
  ('Which business numbers matter?',
   'Payments created / failed, refund latency.',
   '<code>MeterRegistry</code> counter / timer, or <code>@Observed</code> (set <code>management.observations.annotations.enabled=true</code> + <code>spring-boot-starter-aop</code>).', 'w'),
  ('Can I follow one request across A → B → Kafka?',
   'Yes, one traceId everywhere.',
   '<code>micrometer-tracing-bridge-otel</code> + an exporter; clients built from Boot\'s builders propagate headers. For Kafka: <code>spring.kafka.template.observation-enabled=true</code> and <code>spring.kafka.listener.observation-enabled=true</code>.', 'c'),
  ('What goes into the logs?',
   'Business events with paymentId, never card data or tokens.',
   'SLF4J logger; traceId/spanId added by Boot\'s log correlation.', 'w'),
  ('How much tracing in prod?',
   'A sample, not every request.',
   '<code>management.tracing.sampling.probability</code> (default 0.1).', 'c'),
 ],
 write=['metrics in services (MeterRegistry / @Observed)', 'meaningful log lines', 'management.* properties'],
 spring=['Actuator endpoints, health indicators', 'ObservationRegistry, http.server.requests metrics', 'trace context propagation, log correlation']),
]

FEATURE = [
 ('Security', 'security', 'Who calls it and what are they allowed to do? Whose data is it?'),
 ('REST API', 'mvc', 'Which URL, method, request, response and status codes?'),
 ('Errors', 'errors', 'What can go wrong and what does the caller see?'),
 ('Database', 'jpa', 'What is stored or changed? Which queries?'),
 ('Transactions', 'tx', 'What must succeed or fail together?'),
 ('Other services', 'calls', 'Which services do I call? What if they are down?'),
 ('Events', 'kafka', 'Who needs to know afterwards?'),
 ('Observability', 'obs', 'How will I see it working (or failing) in production?'),
 ('Beans & config', 'di', 'Which classes, which settings, what changes per environment?'),
]

EXAMPLE = [
 ('Security', 'Needs scope <code>payments.refund</code>; merchant can refund only its own payments.', 'SecurityConfig rule + ownership check in RefundService'),
 ('REST API', '<code>POST /payments/{id}/refunds</code> {amount, reason} → 201 RefundResponse.', 'RefundController, RefundRequest, RefundResponse'),
 ('Errors', 'Not found 404, already fully refunded 409, amount too big 422.', 'RefundNotAllowedException + handlers in GlobalErrorHandler'),
 ('Database', 'New refund table, payment gets refundedAmount + version.', 'Refund entity, RefundRepository, V3__refunds.sql, @Version on Payment'),
 ('Transactions', 'Insert refund + update payment together.', '@Transactional RefundService.refund'),
 ('Other services', 'None for this feature.', '—'),
 ('Events', 'Ledger must know → PaymentRefunded after commit.', 'PaymentRefundedEvent + publisher (AFTER_COMMIT)'),
 ('Observability', 'Count refunds, log paymentId + amount.', 'Counter "securepay.refunds" + log line'),
 ('Tests', 'Rules, HTTP, security, DB.', 'RefundServiceTest, RefundControllerTest, RefundRepositoryTest'),
]

KIND = {'w': ('write', 'You write'), 'c': ('config', 'You configure'), 's': ('spring', 'Spring / no code')}


def card(n, t):
    links = ''.join('<a class="go" href="index.html#%s/%d/1">▶ %s</a>' % (tp, sc, html.escape(lbl)) for tp, sc, lbl in t['links'])
    rows = ''
    for i, (q, a, b, k) in enumerate(t['qs'], 1):
        cls, lab = KIND[k]
        rows += f'''<li class="qa"><div class="qq"><span class="qn">{i}</span>{html.escape(q)}</div>
<div class="hide"><div class="sp"><span class="lb">SecurePay</span>{a}</div>
<div class="bd"><span class="tag {cls}">{lab}</span>{b}</div></div></li>'''
    write = ''.join('<li>%s</li>' % html.escape(x) for x in t['write'])
    spring = ''.join('<li>%s</li>' % html.escape(x) for x in t['spring'])
    return f'''
<section class="card" id="{t['id']}">
 <div class="hd"><span class="num">{n}</span><div><h2>{t['title']}</h2><div class="area">{t['area']}</div></div></div>
 <ol class="qs">{rows}</ol>
 <div class="cls"><div><h3>You write</h3><ul>{write}</ul></div><div><h3>Spring gives you</h3><ul>{spring}</ul></div></div>
 <div class="links">{links}</div>
</section>'''


feat = ''.join(f'<li><a href="#{i}"><b>{html.escape(a)}</b></a> — {html.escape(q)}</li>' for a, i, q in FEATURE)
ex = ''.join(f'<tr><td><b>{a}</b></td><td>{b}</td><td>{c}</td></tr>' for a, b, c in EXAMPLE)
toc = ''.join(f'<a class="chip" href="#{t["id"]}">{html.escape(t["title"].split(" (")[0])}</a>' for t in TOPICS)

page = '''<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Build It: Developer View</title>
<style>
:root{color-scheme:dark;--bg:#000;--ink:#fff;--muted:#a3a3a3;--faint:#6b6b6b;--line:#2a2a2a;--panel:#0c0e11;--active:#f0a35c;--link:#5cc8f0;--w:#5fd38d;--c:#5cc8f0;--s:#8a8f98}
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
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px 18px;display:grid;gap:12px}
.card>*{min-width:0}
.card h2{margin:0;font-size:20px}
.card h3{margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--active)}
.card p{margin:0}
.card ul,.card ol{margin:0;padding-left:20px}
.hd{display:flex;gap:12px;align-items:center}
.num{flex:0 0 auto;width:32px;height:32px;border-radius:50%;background:var(--active);color:#000;font-weight:700;display:grid;place-items:center}
.area{color:var(--faint);font-size:13px}
code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.88em;color:#e6d3b8;overflow-wrap:anywhere}
.qs{list-style:none;padding:0!important;display:grid;gap:10px}
.qa{border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:#07090b;display:grid;gap:6px}
.qq{font-weight:600;display:flex;gap:10px;align-items:flex-start}
.qn{flex:0 0 auto;min-width:22px;height:22px;border-radius:6px;background:#1c2128;color:var(--muted);font-size:12px;display:grid;place-items:center;margin-top:1px}
.sp,.bd{padding-left:32px;color:#d8d8d8}
.lb,.tag{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.04em;border-radius:4px;padding:1px 6px;margin-right:8px;vertical-align:1px}
.lb{background:#2a2012;color:var(--active)}
.tag.write{background:#10261a;color:var(--w)}
.tag.config{background:#0f2230;color:var(--c)}
.tag.spring{background:#1a1c20;color:var(--s)}
.cls{display:grid;grid-template-columns:1fr 1fr;gap:12px;border-top:1px solid var(--line);padding-top:12px}
.cls>*{min-width:0}
.cls ul{display:grid;gap:3px;font-size:14px}
@media (max-width:640px){.cls{grid-template-columns:1fr}.sp,.bd{padding-left:0}}
.links{display:flex;flex-wrap:wrap;gap:8px}
.go{display:inline-block;border:1px solid #3a414b;border-radius:6px;padding:6px 10px;text-decoration:none;font-size:13.5px;background:#15181d;color:var(--ink)}
.go:hover,.chip:hover{border-color:var(--active)}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{border:1px solid var(--line);border-radius:999px;padding:3px 10px;font-size:13px;text-decoration:none;color:var(--ink);background:#101317}
.bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.toggle{display:inline-flex;gap:8px;align-items:center;border:1px solid #3a414b;border-radius:8px;padding:6px 10px;background:#15181d;cursor:pointer;font-size:14px}
.legend{display:flex;flex-wrap:wrap;gap:6px;font-size:13px;color:var(--muted)}
table{border-collapse:collapse;width:100%;font-size:14px}
th,td{text-align:left;border-bottom:1px solid var(--line);padding:6px 8px;vertical-align:top}
th{color:var(--muted);font-weight:600}
@media (max-width:640px){table,tbody,tr,td{display:block}thead{display:none}tr{border-bottom:1px solid var(--line);padding:6px 0}td{border:0;padding:2px 0}}
body.practice .qa:not(.open) .hide{display:none}
body.practice .qa:not(.open)::after{content:"Answer for SecurePay first, then tap to check";color:var(--faint);font-size:13px;padding-left:32px}
body.practice .qa{cursor:pointer}
</style>
<nav class="top"><b>Build It</b><a href="index.html">Explorer</a><a href="wire.html">Dissect</a><a href="learn.html">Study guide</a><a href="#feature">Feature checklist</a><a href="#example">Example</a></nav>
<main class="wrap">
 <header><h1>Build it: the developer view</h1><p class="sub">Starting a feature = asking questions. The <b>questions are general</b> (same in every project). The <b>answers are SecurePay\'s</b>. Your answers become your list of classes.</p></header>
 <section class="card">
  <div class="bar"><label class="toggle"><input type="checkbox" id="practice"> Practice mode: hide answers</label>
  <span class="legend"><span class="tag write">You write</span>a class <span class="tag config">You configure</span>yml, @Bean or DSL line <span class="tag spring">Spring / no code</span></span></div>
  <div class="chips">''' + toc + '''</div>
 </section>
 <section class="card" id="feature"><h2>Any new feature: ask these first</h2>
  <p>Go through the list, write one-line answers, skip what doesn\'t apply. Each line opens the card with the detailed questions.</p>
  <ol>''' + feat + '''</ol>
  <p class="area">Then write in this order: DTOs → entity + migration → repository → service (+ transaction, rules) → controller → error mapping → security rule → events → tests.</p>
 </section>
''' + ''.join(card(i, t) for i, t in enumerate(TOPICS, 1)) + '''
 <section class="card" id="example"><h2>Worked example: refund a payment (Service B)</h2>
  <p>The same questions answered for one feature. The last column is the class list you start from.</p>
  <table><thead><tr><th>Question</th><th>Answer</th><th>Build</th></tr></thead><tbody>''' + ex + '''</tbody></table>
 </section>
</main>
<script>
(function(){
  var box=document.getElementById('practice');
  box.addEventListener('change',function(){document.body.classList.toggle('practice',box.checked);document.querySelectorAll('.qa.open').forEach(function(e){e.classList.remove('open')});});
  document.addEventListener('click',function(e){var q=e.target.closest('.qa');if(q&&document.body.classList.contains('practice'))q.classList.toggle('open');});
})();
</script>
'''
open(OUT, 'w').write(page)
print('dev.html written:', OUT, len(page))
