var NODES = [
 // ---- instrumentation ----
 ["obsreg","ObservationRegistry","Micrometer Observation API",20,45,210,"inst","One API to instrument code once and get metrics AND traces (and log correlation) from it. Boot auto-configures it."],
 ["httpobs","HTTP server observation","ServerHttpObservationFilter",20,85,210,"inst","Wraps every incoming request in an Observation named http.server.requests (timer + span)."],
 ["clientobs","HTTP client observation","RestClient / WebClient / RestTemplate",20,125,210,"inst","Builders from Boot are instrumented: each outgoing call is an Observation http.client.requests (timer + child span + header propagation)."],
 ["customobs","Your own observation","@Observed / Observation.createNotStarted",20,165,210,"inst","Instrument business operations (e.g. payment.create) with low-cardinality tags."],
 ["handlers","Observation handlers","DefaultMeterObservationHandler, Propagating…TracingObservationHandler",20,205,210,"inst","When an Observation starts/stops, handlers turn it into a timer (DefaultMeterObservationHandler) and a span (DefaultTracingObservationHandler; Propagating Sender/Receiver handlers write/read the traceparent header)."],
 // ---- metrics ----
 ["meterreg","MeterRegistry","Micrometer",250,45,200,"met","Holds all meters (counters, timers, gauges, distribution summaries). Composite registry fans out to backends."],
 ["timer","Timers & counters","http.server.requests, jvm.*, hikaricp.*",250,85,200,"met","Built-in meters: request timings by uri/method/status, JVM memory/GC/threads, Hikari pool, Kafka, Tomcat…"],
 ["tags","Tags (dimensions)","uri, method, status, outcome",250,125,200,"met","Each unique tag combination is a separate time series. Never use ids (paymentId, userId) as tags."],
 ["prom","Prometheus endpoint","/actuator/prometheus",250,165,200,"met","micrometer-registry-prometheus exposes metrics in Prometheus text format; Prometheus scrapes it (pull)."],
 ["dash","Prometheus + Grafana","scrape, store, dashboard, alert",250,205,200,"met","Prometheus stores the time series; Grafana dashboards and alerts (error rate, p99 latency, pool usage)."],
 // ---- tracing ----
 ["tracer","Tracer","Micrometer Tracing (Brave or OpenTelemetry bridge)",470,45,210,"tr","Creates spans for observations. Choose micrometer-tracing-bridge-brave or -bridge-otel plus an exporter."],
 ["span","Trace & span","traceId, spanId, parentId",470,85,210,"tr","A trace is the whole request across services; each hop/operation is a span with a parent."],
 ["prop","Context propagation","W3C traceparent header",470,125,210,"tr","Outgoing calls get a traceparent header (default W3C format) so the next service continues the same trace."],
 ["sampling","Sampling","management.tracing.sampling.probability",470,165,210,"tr","Fraction of traces recorded. Boot default 0.1 (10%)."],
 ["exporter","Exporter","Zipkin / OTLP",470,205,210,"tr","Sends finished spans to a tracing backend (Zipkin, Jaeger/Tempo via OTLP)."],
 ["backend","Tracing UI","Zipkin / Jaeger / Tempo",470,245,210,"tr","Shows the waterfall of spans for one request across Gateway → A → B → DB."],
 // ---- logs ----
 ["mdc","MDC","Mapped Diagnostic Context",700,45,200,"log","ThreadLocal map used by the logging framework. Tracing puts traceId and spanId into it for the current span."],
 ["logpattern","Log correlation","logging.pattern.correlation",700,85,200,"log","Boot 3.2+: log lines automatically include [traceId-spanId] (%correlationId) when tracing is on."],
 ["logagg","Log aggregation","ELK / Loki",700,125,200,"log","Central log store: search all services' logs by traceId."],
 ["ctxprop","Context propagation across threads","ContextSnapshot / TaskDecorator",700,165,200,"log","Copies ThreadLocals (trace context, MDC, SecurityContext) to @Async/executor threads; context-propagation library + ContextPropagatingTaskDecorator."],
 // ---- health/alerts ----
 ["health","Health & probes","/actuator/health",700,225,200,"log","Liveness/readiness for the platform; not a replacement for metrics."],
 // ---- your code ----
 ["svca","Service A","caller",20,440,180,"you","Receives the request from the gateway and calls B."],
 ["svcb","Service B","callee",210,440,180,"you","Handles the payment and writes to the DB."],
 ["yml","application.yml","management.* settings",400,440,180,"you","Exposure, sampling, exporter endpoint, log pattern."],
 ["biz","Business metric","payments.created counter",590,440,180,"you","Your own counter/timer, e.g. payments by status and currency."]
];
var GROUPS = [
 ["Instrumentation (Observation API)",10,22,230,220],["Metrics",240,22,220,220],["Tracing",460,22,230,260],["Logs & context",690,22,220,260],["Your code",10,420,1150,60]
];
var OWN = {
 obsreg:["spring","Auto-configured by Actuator."],
 httpobs:["spring","Automatic for Spring MVC with Actuator."],
 clientobs:["config","Build clients from the Boot-provided RestClient.Builder / WebClient.Builder (not RestClient.create()/RestClient.builder()) to get instrumentation."],
 customobs:["write","@Observed(name = \"payment.create\") with management.observations.annotations.enabled=true + spring-boot-starter-aop (Boot 3.2+), or the Observation API."],
 handlers:["spring","Auto-configured."],
 meterreg:["config","Add a registry dependency (micrometer-registry-prometheus)."],
 timer:["spring","Automatic."],
 tags:["config","management.metrics.tags.application=${spring.application.name}; custom tags on your meters."],
 prom:["config","management.endpoints.web.exposure.include=health,prometheus"],
 dash:["ext","Prometheus/Grafana deployment."],
 tracer:["config","micrometer-tracing-bridge-otel (or -brave) dependency."],
 span:["spring","Created automatically for HTTP in/out; Kafka needs the observation-enabled flags; JDBC needs extra instrumentation (e.g. datasource-micrometer)."],
 prop:["spring","Automatic with instrumented clients; management.tracing.propagation.type=w3c (default)."],
 sampling:["config","management.tracing.sampling.probability=1.0 in dev."],
 exporter:["config","opentelemetry-exporter-otlp (or zipkin-reporter-brave / opentelemetry-exporter-zipkin) + management.otlp.tracing.endpoint or management.zipkin.tracing.endpoint."],
 backend:["ext","Zipkin/Jaeger/Tempo deployment."],
 mdc:["spring","Filled by tracing; read by Logback."],
 logpattern:["config","Automatic in Boot 3.2+; customise logging.pattern.correlation."],
 logagg:["ext","Your logging platform."],
 ctxprop:["config","io.micrometer:context-propagation + ContextPropagatingTaskDecorator bean for executors."],
 health:["config","See the Boot topic (probes)."],
 svca:["write","Your Service A."],
 svcb:["write","Your Service B."],
 yml:["write","Your management.* configuration."],
 biz:["write","MeterRegistry.counter(\"payments.created\", \"currency\", c).increment()"]
};
var SECTIONS = ["REQUEST","TRACE","METRICS","LOG LINE","THREAD","BACKEND"];
