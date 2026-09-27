var SCENARIOS = [
// =====================================================================
{id:"trace", group:"Tracing", name:"One trace across Gateway → A → B (traceparent)",
 goal:"How one traceId follows a request through every service and ends up in logs and the tracing UI.",
 steps:[
 {n:"svca",t:"Request arrives at Service A",w:"POST /payments (no traceparent header — first hop inside our system, or the gateway sent one)",d:[],c:{"REQUEST|traceparent":"(none)"},f:"—",iv:"—"},
 {n:"httpobs",t:"Server observation starts",w:"ServerHttpObservationFilter → Observation 'http.server.requests' start",d:["Registered by Boot's WebMvcObservationAutoConfiguration (Actuator + Spring MVC)."],c:{},f:"—",iv:"—"},
 {n:"handlers",t:"Handlers react",w:"PropagatingReceiverTracingObservationHandler → span (reads traceparent if present); DefaultMeterObservationHandler (wrapped in TracingAwareMeterObservationHandler) → timer sample",d:["One instrumentation, two outputs: a span and a metric."],c:{"TRACE|traceId":"4bf92f35…","TRACE|span A":"http post /payments (root)"},f:"—",iv:"The Observation API instruments once and feeds both metrics and tracing."},
 {n:"tracer",t:"Tracer creates the root span",w:"Micrometer Tracing → OpenTelemetry bridge (or Brave)",d:["No incoming traceparent → this is the root, so sampling is decided here (default 10%)."],c:{"TRACE|sampled":"yes (dev: probability 1.0)"},f:"—",iv:"—"},
 {n:"mdc",t:"MDC gets the ids",w:"tracing puts traceId/spanId into the logging MDC (ThreadLocal) for the current span",d:[],c:{"THREAD|MDC":"traceId=4bf92f35…, spanId=a1b2…","LOG LINE|A":"INFO [service-a] [nio-8080-exec-1] [4bf92f35…-a1b2…] Creating payment"},f:"—",iv:"—"},
 {n:"clientobs",t:"A calls B with RestClient",w:"RestClient (built from Boot's RestClient.Builder) → ObservationRestClientCustomizer → 'http.client.requests'",d:["Child span for the outgoing call."],c:{"TRACE|span A→B":"http post (child of A)"},f:"RestClient.create() / new RestTemplate() bypass Boot's builder → no instrumentation → B starts a NEW trace.",iv:"Build HTTP clients from the Boot-provided builders or the trace breaks between services."},
 {n:"prop",t:"Inject traceparent",w:"PropagatingSenderTracingObservationHandler → W3C propagator → header traceparent: 00-4bf92f35…-c3d4…-01",d:["Default propagation type W3C (B3 optional)."],c:{"REQUEST|to B traceparent":"00-4bf92f35…-c3d4…-01"},f:"—",iv:"Trace context crosses services in the traceparent header (W3C Trace Context)."},
 {n:"svcb",t:"B continues the same trace",w:"B's ServerHttpObservationFilter → PropagatingReceiverTracingObservationHandler extracts traceparent → span with the same traceId, parent = A's client span",d:["B's logs show the same traceId.","Sampling is parent-based: B follows the sampled flag (-01) from A instead of deciding again."],c:{"TRACE|span B":"http post /payments (child)","LOG LINE|B":"INFO [service-b] [nio-8081-exec-3] [4bf92f35…-e5f6…] Payment 42 saved"},f:"—",iv:"—"},
 {n:"prop",t:"Baggage: business ids across services",w:"management.tracing.baggage.remote-fields=tenantId + correlation.fields=tenantId",d:["Travels in headers with the trace and appears in MDC/logs of every service."],c:{},f:"—",iv:"—"},
 {n:"exporter",t:"Spans exported",w:"when each span ends → OTLP/Zipkin exporter (batched, async)",d:[],c:{"BACKEND|spans sent":"3 spans for trace 4bf92f35…"},f:"Exporter endpoint down → spans dropped (the app keeps working).",iv:"—"},
 {n:"backend",t:"Waterfall in the UI",w:"Zipkin / Jaeger / Tempo: search traceId 4bf92f35…",d:["A 120 ms → client call 95 ms → B 90 ms (DB 60 ms if JDBC is instrumented).","Shows exactly which hop is slow."],c:{"BACKEND|view":"A ▸ A→B ▸ B"},f:"—",iv:"A trace answers 'where did the time go' across services; metrics answer 'how often and how slow overall'."},
 {n:"logagg",t:"Logs by traceId",w:"Kibana/Loki query traceId=4bf92f35…",d:["All log lines from A and B for this one request."],c:{},f:"—",iv:"—"}
 ]},
// =====================================================================
{id:"metrics", group:"Metrics", name:"Metrics: http.server.requests → Prometheus → alert",
 goal:"What is measured automatically, how Prometheus gets it, and how you alert on it.",
 steps:[
 {n:"httpobs",t:"Every request is timed",w:"Observation stop → DefaultMeterObservationHandler → Timer 'http.server.requests'",
  d:["Tags: method, uri (template /payments/{id}, not the real id), status, outcome, exception."],c:{"METRICS|http.server.requests":"POST /payments 201 SUCCESS: count+1, 42 ms"},f:"—",iv:"—"},
 {n:"tags",t:"Why the uri tag is a template",w:"low-cardinality key values",d:["/payments/42 and /payments/43 → same series /payments/{id}.","Unknown paths are tagged uri=UNKNOWN / NOT_FOUND to avoid explosions."],c:{},f:"Tagging with paymentId/userId → millions of series → memory blow-up in the app and Prometheus.",iv:"Metric tags must be low-cardinality; ids belong in traces and logs, not metrics."},
 {n:"meterreg",t:"Registry",w:"PrometheusMeterRegistry (micrometer-registry-prometheus)",d:["Also JVM, GC, threads, Hikari pool and Kafka client metrics out of the box.","Tomcat thread metrics (tomcat.threads.*) need server.tomcat.mbeanregistry.enabled=true."],c:{"METRICS|also":"jvm.memory.used, hikaricp.connections.active"},f:"—",iv:"—"},
 {n:"prom",t:"Scrape endpoint",w:"GET /actuator/prometheus (exposed via management.endpoints.web.exposure.include)",d:["Prometheus PULLS on its scrape_interval (default 1 m; 15 s is common in practice)."],c:{"METRICS|endpoint":"/actuator/prometheus"},f:"Not exposed or blocked by security → no data; permit it for the Prometheus network only.",iv:"—"},
 {n:"timer",t:"Percentiles",w:"management.metrics.distribution.percentiles-histogram.http.server.requests=true",d:["Publishes histogram buckets so Prometheus can compute p95/p99 across instances (histogram_quantile)."],c:{"METRICS|buckets":"http_server_requests_seconds_bucket{le=…}"},f:"Averages hide slow requests; alert on p99 latency and error rate.",iv:"—"},
 {n:"timer",t:"Exemplars: from a spike to a trace",w:"Prometheus histogram buckets carry a sample traceId (Boot wires it when tracing + Prometheus are present)",d:["Grafana: click the p99 spike → open that slow request's trace."],c:{},f:"—",iv:"—"},
 {n:"dash",t:"Dashboards and alerts",w:"Grafana: rate(http_server_requests_seconds_count{status=~\"5..\"}[5m]) / rate(…[5m])",d:["Alert: 5xx rate > 2% for 5 min; p99 > 1 s; Hikari pending > 0."],c:{"BACKEND|alert":"PaymentErrorRateHigh (firing)"},f:"—",iv:"The golden signals: latency, traffic, errors, saturation."}
 ]},
// =====================================================================
{id:"custom", group:"Metrics", name:"Business metrics and @Observed",
 goal:"Measuring what the business cares about — payments per status — without cardinality traps.",
 steps:[
 {n:"biz",t:"Counter in your service",w:"meterRegistry.counter(\"payments.created\", \"currency\", p.currency(), \"status\", p.status().name()).increment()",d:["Few currencies × few statuses = few series."],c:{"METRICS|payments.created":"{currency=CAD,status=PENDING} +1"},f:"—",iv:"—"},
 {n:"customobs",t:"@Observed on a method",w:"@Observed(name = \"payment.create\", contextualName = \"create-payment\") + management.observations.annotations.enabled=true (Boot 3.2+, needs spring-boot-starter-aop)",
  d:["One annotation → a timer AND a span for this business operation.","It's AOP: self-invocation skips it (same rule as @Transactional)."],c:{"METRICS|payment.create":"timer","TRACE|span":"create-payment (child of the HTTP span)"},f:"—",iv:"—",z:[["core","self",2,"Why self-invocation skips proxies"]]},
 {n:"tags",t:"Common tags",w:"management.metrics.tags.application=${spring.application.name}",d:["Tags EVERY meter (jvm.*, hikaricp.*, http.*) so dashboards can split by service.","management.observations.key-values.* only adds to observations (observation timers + spans), not to plain meters."],c:{},f:"—",iv:"—"},
 {n:"customobs",t:"Low vs high cardinality",w:"observation.lowCardinalityKeyValue(\"currency\", c) vs highCardinalityKeyValue(\"paymentId\", id)",d:["High-cardinality values go only to spans (searchable in traces), never to metrics.","ObservationPredicate/ObservationFilter beans can skip or modify observations (e.g. don't observe /actuator/**)."],c:{},f:"—",iv:"Put ids on spans (high-cardinality), not on metrics."},
 {n:"meterreg",t:"Protect yourself",w:"MeterFilter.maximumAllowableTags / deny",d:["Caps how many distinct values a tag may have; excess is dropped."],c:{},f:"—",iv:"—"}
 ]},
// =====================================================================
{id:"broken", group:"Tracing", name:"Why the trace breaks (and how to fix it)",
 goal:"The three usual reasons a request shows up as several unrelated traces.",
 steps:[
 {n:"clientobs",t:"1. Uninstrumented client",w:"RestClient.create(\"http://service-b\") or new RestTemplate()",d:["No ObservationRegistry → no child span, no traceparent header → B starts trace 7c1…"],c:{"TRACE|A":"trace 4bf…","TRACE|B":"trace 7c1… (unrelated)"},f:"This is the failure path.",iv:"—"},
 {n:"clientobs",t:"Fix",w:"inject RestClient.Builder (Boot's, observation-enabled) → builder.baseUrl(…).build()",d:["Same for WebClient.Builder and RestTemplateBuilder."],c:{"TRACE|B":"trace 4bf… (joined)"},f:"—",iv:"—"},
 {n:"ctxprop",t:"2. Thread hop (@Async / executor / circuit breaker)",w:"work continues on task-1 → MDC and trace context are ThreadLocals → empty",
  d:["Logs from the async part have no traceId; spans start a new trace."],c:{"THREAD|task-1 MDC":"(empty)"},f:"—",iv:"—",z:[["core","async",2,"Why ThreadLocals don't follow @Async"]]},
 {n:"ctxprop",t:"Fix",w:"@Bean ContextPropagatingTaskDecorator (Spring 6.1) on the Boot executor; context-propagation library for Reactor/others",d:["Copies trace context + MDC (and other registered ThreadLocals) to the worker thread."],c:{"THREAD|task-1 MDC":"traceId=4bf…"},f:"—",iv:"Trace context is ThreadLocal; propagate it across thread pools with a context-propagating TaskDecorator."},
 {n:"prop",t:"3. Messaging without observation",w:"Kafka: spring.kafka.template.observation-enabled=true and spring.kafka.listener.observation-enabled=true (off by default)",d:["Then traceparent travels as a Kafka record header and the consumer continues the trace."],c:{},f:"—",iv:"—",z:[["kafka","produce",0,"The Kafka send path"]]},
 {n:"ctxprop",t:"Reactive code",w:"spring.reactor.context-propagation=auto (Hooks.enableAutomaticContextPropagation)",d:["For WebFlux/Reactor, trace context lives in the Reactor Context and is restored into ThreadLocals for logging."],c:{},f:"—",iv:"—"},
 {n:"sampling",t:"Bonus: 'my trace isn't in Zipkin'",w:"management.tracing.sampling.probability (default 0.1)",d:["Only 10% of traces are exported by default.","Use 1.0 in dev; in prod keep it low or use tail sampling in the collector."],c:{"TRACE|sampled":"9 out of 10 not exported"},f:"—",iv:"—"}
 ]},
// =====================================================================
{id:"logs", group:"Logs", name:"Log correlation: grep one request across services",
 goal:"Turning scattered log lines into one story with traceId.",
 steps:[
 {n:"logpattern",t:"Correlation in every line",w:"Boot 3.2+: %correlationId → [<traceId>-<spanId>] (logging.pattern.correlation to change it)",d:["Added automatically when Micrometer Tracing is on the classpath.","The application name is a separate [service-b] part (logging.include-application-name).","The old Sleuth style [app,traceId,spanId] is gone."],c:{"LOG LINE|B":"INFO 1 --- [service-b] [nio-8081-exec-3] [4bf92f35…-e5f6…] c.s.PaymentService : Payment 42 saved"},f:"—",iv:"—"},
 {n:"mdc",t:"Your own MDC keys",w:"MDC.put(\"paymentId\", \"42\") in a filter/interceptor, cleared in finally",d:["Structured logging (logging.structured.format.console=ecs/logstash, Boot 3.4+) writes MDC keys as JSON fields."],c:{"LOG LINE|B":"{…, traceId:4bf…, paymentId:42}"},f:"Forgetting MDC.remove → the value leaks into the next request on that thread.",iv:"—"},
 {n:"logagg",t:"Search",w:"Loki/ELK: {traceId=\"4bf92f35…\"}",d:["Gateway, A and B lines for the single request, in order."],c:{"BACKEND|log search":"12 lines across 3 services"},f:"—",iv:"Put traceId in every log line and ship logs centrally; then one id finds the whole request."},
 {n:"health",t:"Metrics vs logs vs traces vs health",w:"observability pillars",d:["Metrics: is something wrong? (cheap, aggregated).","Traces: where is it slow/failing? (per request).","Logs: why exactly? (details).","Health: should the platform restart/route traffic?"],c:{},f:"—",iv:"—",z:[["boot","probes",0,"Liveness vs readiness"]]}
 ]},
// =====================================================================
{id:"setup", group:"Metrics", name:"Setup: what a service needs (dependencies + yml)",
 goal:"The minimum to get metrics, traces and correlated logs from Service A and B.",
 steps:[
 {n:"yml",t:"Dependencies",w:"spring-boot-starter-actuator, micrometer-registry-prometheus, micrometer-tracing-bridge-otel, opentelemetry-exporter-otlp",d:["For Zipkin: micrometer-tracing-bridge-brave + io.zipkin.reporter2:zipkin-reporter-brave (or opentelemetry-exporter-zipkin with the OTel bridge)."],c:{},f:"—",iv:"—"},
 {n:"obsreg",t:"ObservationRegistry auto-configured",w:"ObservationAutoConfiguration → ObservationRegistry with meter + tracing handlers",d:["Every instrumented library (MVC, RestClient, Kafka with flags, JDBC with extra libs) reports into it."],c:{},f:"—",iv:"—"},
 {n:"yml",t:"application.yml",w:"management.endpoints.web.exposure.include=health,prometheus · management.tracing.sampling.probability=1.0 (dev) · management.otlp.tracing.endpoint=http://collector:4318/v1/traces",d:[],c:{"BACKEND|config":"prometheus exposed, 100% sampling, OTLP endpoint set"},f:"Missing exporter endpoint → spans created (ids in logs) but never exported.",iv:"—"},
 {n:"span",t:"What you get without writing code",w:"spans for HTTP in/out; metrics for HTTP, JVM, pool; traceId in logs",d:["Add @Observed or custom meters only for business operations."],c:{"TRACE|automatic spans":"http server, http client"},f:"—",iv:"Actuator + Micrometer + a tracing bridge gives metrics, traces and log correlation with zero code; you add business-level observations."}
 ]}
];