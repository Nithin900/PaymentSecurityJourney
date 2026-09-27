var SCENARIOS = [
// =====================================================================
{id:"gateway", group:"Gateway", name:"Request through the Gateway → lb://service-b",
 goal:"One entry point: route match, filters, load-balanced forwarding, response back.",
 steps:[
 {n:"client",t:"Client calls the gateway",w:"POST http://gateway:8080/api/payments, Authorization: Bearer eyJ…",d:["Clients know only the gateway address."],c:{"REQUEST|line":"POST /api/payments","REQUEST|Authorization":"Bearer eyJ…"},f:"—",iv:"—"},
 {n:"gw",t:"Gateway receives it",w:"Reactor Netty server → WebFlux HttpWebHandlerAdapter → DispatcherHandler",d:["Event-loop threads, not one thread per request (unlike Tomcat in the services).","If the gateway is also a resource server it validates the JWT here (optional; services still validate)."],c:{"REQUEST|at":"gateway :8080 (Netty)"},f:"—",iv:"—"},
 {n:"gwyml",t:"Route definition",w:"spring.cloud.gateway.routes: id=payments, uri=lb://service-b, predicates=Path=/api/payments/**, filters=StripPrefix=1",d:["(2025.0 moves these under spring.cloud.gateway.server.webflux.*; the old prefix is deprecated.)"],c:{"ROUTE|config":"payments → lb://service-b"},f:"—",iv:"—"},
 {n:"rphm",t:"Match the route",w:"DispatcherHandler → RoutePredicateHandlerMapping.getHandlerInternal → lookupRoute",d:["Predicates evaluated in route order; first match wins."],c:{"ROUTE|matched":"payments"},f:"No route matches → 404 from the gateway.",iv:"—"},
 {n:"fwh",t:"Build the filter chain",w:"FilteringWebHandler.handle → global filters + route filters sorted by order → DefaultGatewayFilterChain",d:[],c:{"ROUTE|filters":"StripPrefix, ReactiveLoadBalancerClientFilter, NettyRoutingFilter …"},f:"—",iv:"—"},
 {n:"routefilters",t:"Pre filters change the request",w:"StripPrefixGatewayFilterFactory",d:["/api/payments → /payments.","The incoming Authorization: Bearer header is forwarded as-is by default.","(TokenRelay is a different thing: with oauth2-client + oauth2Login the gateway sends its session user's token — the Backend-for-Frontend pattern.)"],c:{"REQUEST|path to B":"/payments"},f:"—",iv:"Gateway filters run 'pre' on the way in and 'post' on the way out."},
 {n:"lbfilter",t:"Resolve lb://service-b",w:"ReactiveLoadBalancerClientFilter → ReactorLoadBalancer.choose",d:["Asks Spring Cloud LoadBalancer for one instance of service-b."],c:{},f:"No instances → 503 Service Unavailable.",iv:"—"},
 {n:"lb",t:"Pick an instance",w:"RoundRobinLoadBalancer.choose ← ServiceInstanceListSupplier (discovery + cache)",d:["Instances :8081 and :8082 registered in Eureka; round robin → :8082 this time."],c:{"ROUTE|target":"http://10.0.0.12:8082/payments"},f:"—",iv:"—",z:[["cloud","discovery",4,"Where the instance list comes from"]]},
 {n:"netty",t:"Forward",w:"NettyRoutingFilter → Reactor Netty HttpClient",d:["Non-blocking: no gateway thread waits for Service B."],c:{"CALL|to":"service-b@:8082"},f:"No response timeout by default! Only when httpclient.response-timeout (or per-route response-timeout) is set does a slow B give 504 Gateway Timeout.",iv:"—"},
 {n:"svcb",t:"Service B handles it",w:"Service B: security filters → MVC → service → DB",d:["B validates the JWT itself (zero trust)."],c:{"CALL|B result":"201 Created"},f:"—",iv:"—",z:[["journey","post-ok",5,"Everything inside Service B"]]},
 {n:"gw",t:"Gateway security notes",w:"forwarded headers, CORS, auth at the edge",d:["Gateway 4.3 only trusts X-Forwarded-*/Forwarded headers from configured trusted proxies.","CORS for browser apps is usually configured once at the gateway."],c:{},f:"—",iv:"—"},
 {n:"netty",t:"Response back",w:"NettyWriteResponseFilter → post filters → client",d:[],c:{"RESPONSE|status":"201 Created"},f:"—",iv:"A gateway centralises routing, auth checks, rate limiting and CORS; services still validate tokens themselves."}
 ]},
// =====================================================================
{id:"discovery", group:"Discovery", name:"Service registration, discovery and dead instances",
 goal:"How callers find instances, and why a crashed instance still gets traffic for a while.",
 steps:[
 {n:"svcb",t:"Service B starts",w:"spring-cloud-starter-netflix-eureka-client on the classpath, spring.application.name=service-b",d:[],c:{"REGISTRY|service-b":"(not registered)"},f:"—",iv:"—"},
 {n:"register",t:"Register with Eureka",w:"EurekaAutoServiceRegistration (SmartLifecycle) → register instance",d:["Sends name, host, port, health URL."],c:{"REGISTRY|service-b":":8081 UP"},f:"—",iv:"—"},
 {n:"eureka",t:"Heartbeats",w:"lease renewal every 30 s",d:["Second instance :8082 registers the same way."],c:{"REGISTRY|service-b":":8081 UP, :8082 UP"},f:"—",iv:"—"},
 {n:"registry",t:"Callers cache the registry",w:"DiscoveryClient fetches the registry every 30 s",d:["Gateway / Service A keep a local copy."],c:{"REGISTRY|caller's copy":":8081, :8082"},f:"—",iv:"—"},
 {n:"lb",t:"Load balancer uses the cached list",w:"CachingServiceInstanceListSupplier (default TTL 35 s) → RoundRobinLoadBalancer",d:[],c:{},f:"—",iv:"—"},
 {n:"svcb",t:":8082 crashes (kill -9)",w:"no deregistration, heartbeats stop",d:[],c:{"REGISTRY|service-b":":8081 UP, :8082 (dead, still listed)"},f:"—",iv:"—"},
 {n:"eureka",t:"Eviction after the lease expires",w:"lease expiry (90 s, effectively ~180 s because of how Eureka's Lease.renew adds the duration) → eviction task (every 60 s)",
  d:["Then the server's response cache (30 s), the callers' registry fetch (30 s) and the LB cache (35 s) delay it further — worst case about 5 minutes of traffic to the dead instance.","With only 2 instances, losing one drops renewals below the 85% threshold → self-preservation stops eviction entirely ('EMERGENCY! EUREKA MAY BE INCORRECTLY CLAIMING INSTANCES ARE UP')."],c:{"REGISTRY|service-b":":8081 UP (eventually)"},f:"Minutes of failed calls to a dead instance → you need timeouts, retries and circuit breakers.",
  iv:"Discovery is eventually consistent: combine it with timeouts, retries (idempotent calls only) and circuit breakers."},
 {n:"lbclient",t:"Kubernetes alternative",w:"spring-cloud-kubernetes or plain Kubernetes Services",d:["On Kubernetes, the platform's Service + readiness probes often replace Eureka and client-side load balancing."],c:{},f:"—",iv:"—"}
 ]},
// =====================================================================
{id:"feign", group:"Service calls", name:"OpenFeign call A → B with token relay",
 goal:"A declarative client: what the proxy does, how the JWT is forwarded, how errors come back.",
 steps:[
 {n:"feign",t:"Your Feign interface",w:"@FeignClient(name = \"service-b\") interface PaymentClient { @PostMapping(\"/payments\") PaymentDto create(@RequestBody CreatePayment req); }",d:[],c:{},f:"—",iv:"—"},
 {n:"feignfb",t:"Startup: proxy created",w:"@EnableFeignClients → FeignClientsRegistrar → FeignClientFactoryBean.getObject → Feign.Builder → ReflectiveFeign.newInstance",
  d:["SpringMvcContract reads the Spring MVC annotations.","Each client gets its own child context (encoder, decoder, interceptors)."],c:{"CALL|bean":"PaymentClient → JDK proxy"},f:"—",iv:"—"},
 {n:"svca",t:"Service A calls it",w:"paymentClient.create(req)",d:["Inside A's request thread (SecurityContext holds the user's JWT)."],c:{"CALL|method":"create(req)"},f:"—",iv:"—"},
 {n:"feigncall",t:"Build the request",w:"SynchronousMethodHandler.invoke → RequestTemplate (POST /payments, JSON body via SpringEncoder/Jackson)",d:[],c:{"REQUEST|line":"POST http://service-b/payments"},f:"—",iv:"—"},
 {n:"reqint",t:"Add the token",w:"your RequestInterceptor.apply → SecurityContextHolder.getContext().getAuthentication() → JwtAuthenticationToken → Authorization: Bearer …",
  d:["Reads a ThreadLocal: works only on the same thread."],c:{"REQUEST|Authorization":"Bearer eyJ… (user's token)"},f:"Call wrapped in a Spring Cloud circuit breaker runs on the breaker's thread pool (default) → no SecurityContext → B returns 401.",iv:"Token relay in Feign = a RequestInterceptor that copies the current token; it depends on the ThreadLocal SecurityContext."},
 {n:"lb",t:"Resolve service-b",w:"FeignBlockingLoadBalancerClient → LoadBalancerClient.choose",d:[],c:{"CALL|to":"service-b@:8081"},f:"—",iv:"—"},
 {n:"svcb",t:"B answers 409",w:"PaymentAlreadyExists → 409 ProblemDetail",d:[],c:{"RESPONSE|status":"409"},f:"—",iv:"—"},
 {n:"errdec",t:"Error decoding",w:"ErrorDecoder.Default → FeignException.Conflict",
  d:["Without your own ErrorDecoder, A's code sees a FeignException; unhandled it becomes a 500 in A.","Map it: custom ErrorDecoder → your PaymentConflictException → A's @RestControllerAdvice → 409."],c:{"CALL|exception":"FeignException.Conflict"},f:"—",iv:"Pass downstream errors through deliberately (ErrorDecoder + advice); otherwise every B error becomes a 500 in A."}
 ]},
// =====================================================================
{id:"httpiface", group:"Service calls", name:"@LoadBalanced RestClient and HTTP interface clients",
 goal:"The Spring Framework alternative to Feign (OpenFeign is in maintenance mode).",
 steps:[
 {n:"lbclient",t:"Load-balanced builder",w:"@Bean @LoadBalanced RestClient.Builder builder() → LoadBalancerRestClientBuilderBeanPostProcessor adds DeferringLoadBalancerInterceptor",d:["http://service-b/... is resolved per call (LoadBalancerInterceptor, or RetryLoadBalancerInterceptor with spring-retry)."],c:{"CALL|base url":"http://service-b"},f:"Using a non-@LoadBalanced builder with a service name → ResourceAccessException (UnknownHostException).",iv:"—"},
 {n:"httpiface",t:"Declarative interface",w:"interface PaymentApi { @PostExchange(\"/payments\") PaymentDto create(@RequestBody CreatePayment req); } + HttpServiceProxyFactory.builderFor(RestClientAdapter.create(restClient)).build().createClient(PaymentApi.class)",
  d:["Same idea as Feign, but part of Spring Framework: 6.0 with WebClient; RestClientAdapter (blocking) since 6.1."],c:{"CALL|bean":"PaymentApi proxy"},f:"—",iv:"—"},
 {n:"lb",t:"Instance chosen per call",w:"DeferringLoadBalancerInterceptor → LoadBalancerInterceptor → BlockingLoadBalancerClient",d:[],c:{"CALL|to":"service-b@:8082"},f:"—",iv:"—"},
 {n:"svcb",t:"Errors",w:"4xx/5xx → HttpClientErrorException / HttpServerErrorException (RestClient default status handler)",d:["Customise with defaultStatusHandler on the RestClient."],c:{},f:"—",iv:"New code: RestClient + @HttpExchange interfaces; Feign still works but is feature-complete."}
 ]},
// =====================================================================
{id:"breaker", group:"Resilience", name:"Circuit breaker opens, falls back, recovers",
 goal:"Stop hammering a failing Service B and fail fast instead.",
 steps:[
 {n:"cbfactory",t:"Wrap the call",w:"circuitBreakerFactory.create(\"serviceB\").run(() -> paymentApi.create(req), ex -> fallback(req, ex))",d:[],c:{"BREAKER|state":"CLOSED"},f:"—",iv:"—"},
 {n:"window",t:"Failures are counted",w:"CircuitBreakerStateMachine → sliding window (default 100 calls, min 100 calls, 50% threshold)",
  d:["B starts timing out; each failure recorded.","Slow calls (above slowCallDurationThreshold) can count too."],c:{"BREAKER|failure rate":"62% of last 100"},f:"—",iv:"—"},
 {n:"cbstate",t:"Threshold crossed → OPEN",w:"failureRate ≥ failureRateThreshold → transition to OPEN",d:["For waitDurationInOpenState (default 60 s) every call is rejected immediately."],c:{"BREAKER|state":"OPEN"},f:"—",iv:"—"},
 {n:"fallback",t:"Fail fast",w:"CallNotPermittedException → your fallback",
  d:["No network call, no thread waiting for B.","Fallback: queue the payment for later / return 503 with a clear message — never fake success for money movements."],c:{"RESPONSE|status":"503 (fallback: payment service temporarily unavailable)"},f:"—",iv:"An open circuit protects both sides: the caller fails fast and the failing service gets room to recover."},
 {n:"cbstate",t:"HALF_OPEN trial",w:"first call after 60 s → HALF_OPEN (no timer by default: automaticTransitionFromOpenToHalfOpenEnabled=false) → permittedNumberOfCallsInHalfOpenState (default 10)",d:["Failure (and slow-call) rate of the 10 trial calls below the threshold → CLOSED; above → OPEN again."],c:{"BREAKER|state":"HALF_OPEN → CLOSED"},f:"—",iv:"CLOSED → OPEN on failure rate, OPEN → HALF_OPEN after a wait, HALF_OPEN → CLOSED/OPEN from trial calls."},
 {n:"bulkhead",t:"Bulkhead",w:"Resilience4j Bulkhead (semaphore) / ThreadPoolBulkhead",d:["Limits concurrent calls to B so a slow B can't use up all of A's threads.","Spring Cloud: spring.cloud.circuitbreaker.bulkhead.resilience4j.enabled; semaphore bulkhead option available."],c:{"BREAKER|bulkhead":"max 20 concurrent calls to B"},f:"—",iv:"Circuit breaker stops calls to a failing service; bulkhead caps concurrent calls so one slow dependency can't exhaust your threads."},
 {n:"timelimiter",t:"Threads and the time limiter",w:"Resilience4JCircuitBreaker.run → ExecutorService (default cached thread pool) + TimeLimiter (default 1 s)",
  d:["By default Spring Cloud's Resilience4j breaker runs the call on its own thread pool — even with the time limiter disabled. Only spring.cloud.circuitbreaker.resilience4j.disable-thread-pool=true keeps it on the caller thread (then no time limiter).","ThreadLocals (SecurityContext, MDC, transaction) are NOT there unless propagated."],c:{},f:"B normally takes 1.5 s → every call times out at 1 s → breaker opens for nothing. Tune timeout-duration.",iv:"—"}
 ]},
// =====================================================================
{id:"retry", group:"Resilience", name:"Retry + idempotency: never double-charge",
 goal:"Why blind retries are dangerous for payments and how an idempotency key fixes it.",
 steps:[
 {n:"svca",t:"A sends POST /payments",w:"paymentApi.create(req) with Retry (3 attempts)",d:[],c:{"CALL|attempt":"1"},f:"—",iv:"—"},
 {n:"svcb",t:"B commits, but the response is lost",w:"B inserts the payment and commits; network drops before A gets the 201",d:[],c:{"CALL|B state":"payment 43 CREATED"},f:"—",iv:"—"},
 {n:"retry",t:"A retries",w:"Resilience4j Retry → attempt 2 (after 500 ms)",d:["A has no idea the first attempt succeeded."],c:{"CALL|attempt":"2","CALL|B state":"payment 43 CREATED, payment 44 CREATED (duplicate!)"},f:"Double charge.",iv:"—"},
 {n:"svcb",t:"Fix: idempotency key",w:"Idempotency-Key: 7f3c… header; B stores key → result (unique constraint)",
  d:["Same key again → B returns the stored result instead of creating another payment.","Retries become safe."],c:{"CALL|B state":"payment 43 only; retry returns the same 201"},f:"—",iv:"Only retry idempotent operations; make POSTs idempotent with an idempotency key stored by the server."},
 {n:"timelimiter",t:"Timeout budget per hop",w:"gateway timeout > A's timeout × attempts > B's work time",
  d:["Every hop needs connect + read timeouts (Feign, RestClient, gateway httpclient).","If the gateway gives up before A finishes its retries, A keeps working for nobody."],c:{},f:"—",iv:"Set explicit timeouts on every hop and make outer timeouts larger than inner timeout × retries."},
 {n:"retry",t:"Order of decorators",w:"Retry ( CircuitBreaker ( TimeLimiter ( call ) ) )",
  d:["Retrying on CallNotPermittedException just wastes time — exclude it.","Too many retry layers (gateway + A + client) multiply load on a sick service (retry storm)."],c:{},f:"—",iv:"—"}
 ]},
// =====================================================================
{id:"config", group:"Config", name:"Central config: import at startup, refresh at runtime",
 goal:"One Git repo of settings for all services, and changing them without redeploying.",
 steps:[
 {n:"configgit",t:"Config in Git",w:"service-b.yml, service-b-prod.yml in the config repo",d:["payment.max-amount: 5000"],c:{"CONFIG|git":"payment.max-amount=5000"},f:"—",iv:"—"},
 {n:"cfgclient",t:"Service B starts",w:"spring.config.import=optional:configserver:http://config:8888 → ConfigServerConfigDataLoader",
  d:["Loaded during Environment preparation, before beans (a Boot ConfigData import)."],c:{},f:"Without optional: and the server down → startup fails.",iv:"—",z:[["boot","props",0,"Where property values come from"]]},
 {n:"cfgserver",t:"Server resolves the files",w:"EnvironmentController GET /service-b/prod/main",d:[],c:{},f:"—",iv:"—"},
 {n:"cfgrepo",t:"Read from Git",w:"JGitEnvironmentRepository → clone/pull → service-b.yml + service-b-prod.yml",d:[],c:{"CONFIG|B environment":"configserver: payment.max-amount=5000"},f:"—",iv:"—"},
 {n:"configgit",t:"Change the value",w:"commit payment.max-amount: 8000",d:["Running services don't notice by themselves."],c:{"CONFIG|git":"payment.max-amount=8000"},f:"—",iv:"—"},
 {n:"refresh",t:"Refresh",w:"POST /actuator/refresh → ContextRefresher.refresh → EnvironmentChangeEvent → ConfigurationPropertiesRebinder + RefreshScope.refreshAll",
  d:["@ConfigurationProperties beans are rebound automatically.","@Value fields update only in @RefreshScope beans (recreated on next use).","Spring Cloud Bus (/actuator/busrefresh over Kafka/RabbitMQ) refreshes all instances at once."],c:{"CONFIG|B environment":"payment.max-amount=8000"},f:"Refreshing one instance only → instances disagree until all are refreshed.",
  iv:"Config Server + spring.config.import for central config; @ConfigurationProperties rebinding or @RefreshScope for runtime changes."}
 ]},
// =====================================================================
{id:"ratelimit", group:"Gateway", name:"Gateway rate limiting → 429",
 goal:"Protecting the payment API from bursts per user.",
 steps:[
 {n:"gwyml",t:"Configure the filter",w:"filters: RequestRateLimiter (redis-rate-limiter.replenishRate=10, burstCapacity=20, key-resolver=#{@userKeyResolver})",d:[],c:{"ROUTE|limit":"10/s per user, burst 20"},f:"—",iv:"—"},
 {n:"ratelimit",t:"Key per caller",w:"KeyResolver bean → JWT subject (or IP)",d:[],c:{"REQUEST|key":"nithin"},f:"—",iv:"—"},
 {n:"ratelimit",t:"Token bucket in Redis",w:"RedisRateLimiter.isAllowed → Lua script (atomic)",d:["Shared across gateway instances because the state is in Redis."],c:{"ROUTE|tokens left":"0"},f:"Redis down → by default requests are allowed (fail open).",iv:"—"},
 {n:"ratelimit",t:"Rejected",w:"RequestRateLimiterGatewayFilterFactory → 429 Too Many Requests + X-RateLimit-Remaining: 0",d:["The filter completes the response; NettyRoutingFilter never runs, B never sees it.","Empty key from the KeyResolver → 403 by default (deny-empty-key=true)."],c:{"RESPONSE|status":"429 Too Many Requests"},f:"—",iv:"Rate limiting at the gateway with a shared store (Redis) keeps limits correct across gateway instances."}
 ]},
// =====================================================================
{id:"saga", group:"Resilience", name:"Saga: a payment across services without a distributed transaction",
 goal:"Why one @Transactional can't span services, and how compensation replaces rollback.",
 steps:[
 {n:"svca",t:"Business flow across services",w:"reserve funds (Account service) → create payment (Payment service) → notify (Notification service)",d:["Each service has its own database; there's no shared transaction."],c:{"CALL|step":"1/3"},f:"—",iv:"—"},
 {n:"saga",t:"Why not 2PC/XA",w:"one global transaction coordinator",d:["Slow, locks across services, not supported by Kafka or most cloud databases, availability suffers."],c:{},f:"—",iv:"—"},
 {n:"saga",t:"Saga = local transactions + compensations",w:"orchestration (a coordinator calls each step) or choreography (services react to events)",
  d:["Step 2 fails → run compensations for completed steps: release the reserved funds.","Every step and compensation must be idempotent (messages/retries can repeat)."],c:{"CALL|step":"2 failed → compensate step 1"},f:"—",iv:"A saga replaces a distributed transaction with local transactions plus compensating actions; consistency is eventual."},
 {n:"svcb",t:"Reliable events",w:"transactional outbox + Kafka",d:["Each local transaction writes its event to an outbox table so no step's event is lost."],c:{},f:"—",iv:"—",z:[["kafka","dual",0,"Outbox and the dual-write problem"]]}
 ]}
];