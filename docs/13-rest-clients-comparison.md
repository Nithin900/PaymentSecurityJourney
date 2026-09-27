# RestTemplate vs Feign vs WebClient (21 Sep)

From the chat "REST template, Feign, WebClient comparison". Relevant because Service A calls Service B with WebClient.

| | RestTemplate | Feign | WebClient |
|---|---|---|---|
| Style | Sync, imperative | Sync by default, declarative | Reactive (async `Mono`/`Flux`, or sync via `.block()`) |
| Threads | Blocking, thread-per-request | Blocking | Non-blocking event loop (Netty) |
| Status | Maintenance mode since Spring 5 | Active (Spring Cloud OpenFeign) | Active, recommended |
| Best fit | Legacy, simple sync calls | Many declarative microservice clients | High throughput, reactive, streaming |
| Native async | No (`AsyncRestTemplate` deprecated) | No (needs `feign-reactor`) | Yes |

## RestTemplate
```java
@Bean
public RestTemplate restTemplate(RestTemplateBuilder builder) {
    return builder.setConnectTimeout(Duration.ofSeconds(3))
                  .setReadTimeout(Duration.ofSeconds(5)).build();
}
public OrderDto getOrder(Long id) {
    return restTemplate.getForObject("http://order-service/orders/{id}", OrderDto.class, id);
}
```
"Async" = `@Async` + `CompletableFuture` → still blocking, just another thread.
- Consequences: each call holds a thread → pool exhaustion; no built-in resilience; default timeout infinite.
- Mitigation: low-throughput/legacy only; always set timeouts; Resilience4j.

## Feign
```java
@FeignClient(name = "order-service", url = "${order.service.url}", configuration = FeignConfig.class)
public interface OrderFeignClient {
    @GetMapping("/orders/{id}")
    OrderDto getOrder(@PathVariable Long id);
}
// FeignConfig: Request.Options(3000 ms, 5000 ms), Retryer.Default(100, 1000, 3)
```
Reactive: `@ReactiveFeignClient` from `feign-reactor` (third party).
- Consequences: clean code; same blocking problem; `FeignException` hides details; retries on non-idempotent POST cause duplicates.
- Mitigation: explicit `Request.Options` + `Retryer`; Resilience4j; retry only idempotent calls; prefer WebClient over feign-reactor.

## WebClient
```java
@Bean
public WebClient orderWebClient(WebClient.Builder builder) {
    HttpClient httpClient = HttpClient.create()
        .responseTimeout(Duration.ofSeconds(5))
        .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 3000);
    return builder.baseUrl("http://order-service")
        .clientConnector(new ReactorClientHttpConnector(httpClient)).build();
}

public Mono<OrderDto> getOrder(Long id) {                 // async
    return webClient.get().uri("/orders/{id}", id).retrieve()
        .onStatus(HttpStatusCode::is4xxClientError, r -> Mono.error(new NotFoundException()))
        .bodyToMono(OrderDto.class)
        .timeout(Duration.ofSeconds(5))
        .retryWhen(Retry.backoff(3, Duration.ofMillis(200)));
}

public OrderDto getOrderBlocking(Long id) {               // sync in an MVC app
    return webClient.get().uri("/orders/{id}", id).retrieve()
        .bodyToMono(OrderDto.class).block(Duration.ofSeconds(5));
}
```
- Consequences: real non-blocking throughput; reactive learning curve; easy to block the event loop; `.block()` in MVC = no gain over RestTemplate.
- Mitigation: in MVC, `.block()` is fine as a modern client; for real gains go reactive end-to-end (WebFlux, R2DBC); offload blocking code to `Schedulers.boundedElastic()`; always set timeouts + retry + circuit breaker.

## Choosing
- Legacy MVC, low concurrency → RestTemplate (plan migration)
- Many declarative clients on servlet stack → Feign + Resilience4j
- New service, high concurrency / WebFlux → WebClient, no `.block()`
- New MVC service wanting a better client → WebClient with `.block()` (or `RestClient` in Spring 6.1+)

**Cascading failures** affect all three → explicit timeouts + Resilience4j `CircuitBreaker` + `Bulkhead` + `Retry` + fallbacks.

## Link to this project
- Token relay in A: servlet `ServletBearerExchangeFilterFunction` vs reactive `ServerBearerExchangeFilterFunction` — match A's stack.
- Client credentials: `RestClient` + `OAuth2ClientHttpRequestInterceptor` (Spring Security 6.4+), or `WebClient` + `ServletOAuth2AuthorizedClientExchangeFilterFunction`.
