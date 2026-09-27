var SCENARIOS = [
// =====================================================================
{id:"mappings", group:"Startup", name:"Startup: building the URL → method registry",
 goal:"Your @GetMapping/@PostMapping annotations become a lookup table before any request arrives.",
 steps:[
 {n:"ctrl",t:"Your controller bean exists",w:"@RestController @RequestMapping(\"/payments\") class PaymentController",d:["Created like any bean (it's a @Component)."],c:{"HANDLER|beans":"paymentController"},f:"—",iv:"—"},
 {n:"hm",t:"Scan beans for handler methods",w:"RequestMappingHandlerMapping.afterPropertiesSet → initHandlerMethods → detectHandlerMethods",
  d:["For every bean whose type has @Controller (since 6.0 a type-level @RequestMapping alone is not enough), looks at each method's mapping annotation."],c:{},f:"—",iv:"Handler mappings are computed once at startup, not per request."},
 {n:"registry",t:"Register each mapping",w:"getMappingForMethod → RequestMappingInfo → MappingRegistry.register",
  d:["POST /payments → PaymentController#create, consumes JSON.","GET /payments/{id} → PaymentController#get.","Path patterns parsed with PathPatternParser (default)."],
  c:{"HANDLER|mappings":"POST /payments → create, GET /payments/{id} → get, POST /payments/{id}/refund → refund"},
  f:"Two methods with the same path + method → IllegalStateException 'Ambiguous mapping. Cannot map … There is already … mapped.' — startup fails.",iv:"Duplicate mappings are detected at startup, not at request time."},
 {n:"registry",t:"Trailing slash no longer matches",w:"Spring Framework 6.0: trailing-slash matching disabled by default",
  d:["GET /payments/ does NOT match /payments any more → 404.","Common surprise after upgrading from Boot 2."],c:{},f:"—",iv:"—"},
 {n:"ds",t:"DispatcherServlet ready",w:"DispatcherServletAutoConfiguration → registered at \"/\"",d:["Initialised (initStrategies) lazily on the first request by default."],c:{"REQUEST|mapped at":"/"},f:"—",iv:"—"}
 ]},
// =====================================================================
{id:"get", group:"Request handling", name:"GET /payments/42 → path variable → ResponseEntity → JSON",
 prev:["journey","post-ok",7,"How the request got into the DispatcherServlet"],
 goal:"The full doDispatch path for a simple read: mapping, argument conversion, invocation, content negotiation, JSON.",
 steps:[
 {n:"client",t:"Request",w:"GET /payments/42, Accept: application/json",d:["Security already passed (filters run before MVC)."],c:{"REQUEST|line":"GET /payments/42","REQUEST|Accept":"application/json"},f:"—",iv:"—"},
 {n:"ds",t:"doDispatch starts",w:"DispatcherServlet.doService → doDispatch",d:["doService exposes the WebApplicationContext, locale resolver etc. as request attributes, then calls doDispatch."],c:{"REQUEST|dispatcher":"doDispatch"},f:"—",iv:"—"},
 {n:"multipart",t:"Multipart check",w:"DispatcherServlet.checkMultipart → MultipartResolver.isMultipart",d:["Not multipart/form-data → request used as is. For uploads it's wrapped so MultipartFile parameters work."],c:{},f:"File bigger than spring.servlet.multipart.max-file-size → MaxUploadSizeExceededException.",iv:"—"},
 {n:"hm",t:"Find the handler",w:"getHandler → RequestMappingHandlerMapping.getHandlerInternal → lookupHandlerMethod",
  d:["Direct path matches first, then pattern matches; best match by specificity.","URI variables extracted: id = \"42\" (stored as a request attribute)."],c:{"HANDLER|method":"PaymentController#get(Long id)","HANDLER|uri variables":"id=\"42\""},f:"No match → 404; path matches but method differs → 405 (next scenarios).",iv:"—"},
 {n:"ha",t:"Pick the adapter",w:"DispatcherServlet.getHandlerAdapter → RequestMappingHandlerAdapter (supports HandlerMethod)",d:["Chosen before the interceptors run."],c:{"HANDLER|adapter":"RequestMappingHandlerAdapter"},f:"—",iv:"—"},
 {n:"hec",t:"Interceptors preHandle",w:"HandlerExecutionChain.applyPreHandle",d:["OSIV interceptor, locale, yours… Any preHandle returning false stops the request."],c:{"HANDLER|interceptors":"preHandle ✓"},f:"—",iv:"doDispatch order: checkMultipart → getHandler → getHandlerAdapter → preHandle → handle → postHandle → processDispatchResult → afterCompletion."},
 {n:"ha",t:"Adapter invokes the handler",w:"RequestMappingHandlerAdapter.handle → handleInternal → invokeHandlerMethod",d:["Creates the WebDataBinderFactory and ModelFactory for this handler."],c:{},f:"—",iv:"—"},
 {n:"argres",t:"Resolve the argument",w:"HandlerMethodArgumentResolverComposite → PathVariableMethodArgumentResolver",d:["Finds the resolver that supports @PathVariable (cached per parameter)."],c:{"ARGUMENTS|id":"\"42\" (String)"},f:"—",iv:"—"},
 {n:"conv",t:"Convert \"42\" → Long",w:"WebDataBinder.convertIfNecessary → ConversionService",d:[],c:{"ARGUMENTS|id":"42L (Long)"},f:"\"abc\" → MethodArgumentTypeMismatchException → 400 (see scenario).",iv:"All URL/query/header values arrive as strings; the binder's ConversionService converts them."},
 {n:"ihm",t:"Call your method",w:"ServletInvocableHandlerMethod.invokeAndHandle → InvocableHandlerMethod.doInvoke (reflection)",d:["paymentController.get(42L) → service → repository."],c:{"RETURN VALUE|type":"ResponseEntity<PaymentResponse> (200)"},f:"Exception from your code → exception resolvers (see error scenarios).",iv:"—"},
 {n:"retval",t:"Pick a return value handler",w:"HandlerMethodReturnValueHandlerComposite → HttpEntityMethodProcessor",d:["ResponseEntity → status and headers from it, body via converters."],c:{"RESPONSE|status":"200"},f:"—",iv:"—"},
 {n:"negot",t:"Choose the media type",w:"AbstractMessageConverterMethodProcessor.writeWithMessageConverters → ContentNegotiationManager",d:["Accept: application/json ∩ what converters can produce for PaymentResponse → application/json."],c:{"RESPONSE|Content-Type":"application/json"},f:"Accept: application/xml with no XML converter → 406 Not Acceptable.",iv:"—"},
 {n:"advicebody",t:"ResponseBodyAdvice hook",w:"RequestResponseBodyAdviceChain.beforeBodyWrite",d:["Any @ControllerAdvice implementing ResponseBodyAdvice may wrap or change the body now (e.g. add a traceId)."],c:{},f:"—",iv:"—"},
 {n:"converters",t:"Write JSON",w:"MappingJackson2HttpMessageConverter.write → ObjectMapper",d:["Status and headers are sent first, then the JSON body."],c:{"RESPONSE|body":"{\"id\":42,\"status\":\"COMPLETED\",\"amount\":100.00}"},f:"—",iv:"—"},
 {n:"hec",t:"postHandle and afterCompletion",w:"applyPostHandle → processDispatchResult → triggerAfterCompletion",
  d:["For @ResponseBody the body is already written before postHandle, so postHandle can't change it (use ResponseBodyAdvice).","afterCompletion always runs, even after exceptions — good for cleanup/timing."],c:{"HANDLER|interceptors":"postHandle ✓, afterCompletion ✓"},f:"—",
  iv:"Filter = servlet level around everything; HandlerInterceptor = MVC level around the handler with access to the HandlerMethod."}
 ]},
// =====================================================================
{id:"post", extra:["dto"], group:"Request handling", name:"POST with @RequestBody + @Valid (and 415)",
 goal:"Reading JSON into a DTO, validating it, and what Content-Type has to do with it.",
 steps:[
 {n:"client",t:"JSON body",w:"POST /payments, Content-Type: application/json",d:[],c:{"REQUEST|line":"POST /payments","REQUEST|Content-Type":"application/json","REQUEST|body":"{amount:100.00, currency:CAD, toAccount:ACC-9}"},f:"—",iv:"—"},
 {n:"hm",t:"consumes matches",w:"RequestMappingInfo: POST /payments, consumes = application/json",d:["Content-Type is part of the match."],c:{"HANDLER|method":"PaymentController#create"},f:"Content-Type: text/plain → HttpMediaTypeNotSupportedException → 415.",iv:"—"},
 {n:"body",t:"@RequestBody resolver",w:"RequestResponseBodyMethodProcessor.resolveArgument → readWithMessageConverters",d:["RequestBodyAdvice.beforeBodyRead hooks run first."],c:{},f:"—",iv:"—"},
 {n:"converters",t:"Jackson reads the stream",w:"MappingJackson2HttpMessageConverter.read → ObjectMapper.readValue",d:["Unknown JSON fields are ignored by Boot's default ObjectMapper (FAIL_ON_UNKNOWN_PROPERTIES = false)."],c:{"ARGUMENTS|req":"CreatePaymentRequest(amount=100.00, currency=CAD, toAccount=ACC-9)"},
  f:"Malformed JSON or wrong types (\"amount\":\"abc\") → HttpMessageNotReadableException → 400.",iv:"—"},
 {n:"valid",t:"@Valid",w:"validateIfApplicable → WebDataBinder.validate → Hibernate Validator",d:["Constraint errors collected in a BindingResult.","@Validated(OnCreate.class) instead of @Valid selects validation groups.","6.1+: if the same method also has constraints on other parameters, the whole call goes through method validation → HandlerMethodValidationException instead."],c:{"VALIDATION|result":"0 errors"},f:"Errors → MethodArgumentNotValidException → 400 (unless you add a BindingResult parameter right after the argument).",iv:"@Valid on @RequestBody throws MethodArgumentNotValidException; handle it once in @RestControllerAdvice."},
 {n:"ihm",t:"Controller runs",w:"PaymentController.create(req, jwt)",d:["Calls the service proxy (see the journey)."],c:{"RETURN VALUE|type":"ResponseEntity.created(/payments/43).body(…)"},f:"—",iv:"—",z:[["journey","post-ok",14,"Service proxy, @Transactional, DB"]]},
 {n:"retval",t:"201 + Location + JSON",w:"HttpEntityMethodProcessor → Jackson write",d:[],c:{"RESPONSE|status":"201 Created","RESPONSE|Location":"/payments/43"},f:"—",iv:"—"}
 ]},
// =====================================================================
{id:"e404", group:"Errors", name:"404: no mapping (NoResourceFoundException)",
 goal:"Why an unknown URL in Boot 3.2+ ends up in the static resource handler.",
 steps:[
 {n:"client",t:"Typo in the URL",w:"GET /payment/42 (missing s)",d:[],c:{"REQUEST|line":"GET /payment/42"},f:"—",iv:"—"},
 {n:"hm",t:"No @RequestMapping matches",w:"RequestMappingHandlerMapping.getHandler → null",d:["Next HandlerMapping in order is tried."],c:{"HANDLER|method":"none"},f:"—",iv:"—"},
 {n:"res",t:"Static resource mapping catches /**",w:"SimpleUrlHandlerMapping → ResourceHttpRequestHandler.handleRequest",d:["Looks for classpath:/static/payment/42 … not found."],c:{"HANDLER|method":"ResourceHttpRequestHandler (/**)"},f:"—",iv:"—"},
 {n:"dher",t:"NoResourceFoundException → 404",w:"ResourceHttpRequestHandler throws NoResourceFoundException (6.1+) → DefaultHandlerExceptionResolver",
  d:["Before 6.1 this was a silent 404; now it's an exception your @ControllerAdvice (or ResponseEntityExceptionHandler) can turn into ProblemDetail."],c:{"RESPONSE|status":"404 Not Found"},f:"—",
  iv:"In Spring 6.1+, a missing route surfaces as NoResourceFoundException, which you can handle like any other exception."}
 ]},
// =====================================================================
{id:"e405", group:"Errors", name:"405 wrong method, 406/415 media types, 400 type mismatch",
 goal:"The framework exceptions DefaultHandlerExceptionResolver maps for you.",
 steps:[
 {n:"client",t:"DELETE on a POST-only path",w:"DELETE /payments",d:[],c:{"REQUEST|line":"DELETE /payments"},f:"—",iv:"—"},
 {n:"hm",t:"Path matches, method doesn't",w:"RequestMappingInfoHandlerMapping.handleNoMatch → HttpRequestMethodNotSupportedException",d:["The mapping knows which methods exist for that path."],c:{},f:"—",iv:"—"},
 {n:"dher",t:"405 + Allow header",w:"DefaultHandlerExceptionResolver.handleHttpRequestMethodNotSupported",d:[],c:{"RESPONSE|status":"405 Method Not Allowed","RESPONSE|Allow":"GET, POST"},f:"—",iv:"405 means the URL exists but not for that HTTP method; the Allow header lists what does."},
 {n:"client",t:"Bad path variable",w:"GET /payments/abc",d:[],c:{"REQUEST|line":"GET /payments/abc","RESPONSE|status":null,"RESPONSE|Allow":null},f:"—",iv:"—"},
 {n:"conv",t:"Conversion fails",w:"WebDataBinder → MethodArgumentTypeMismatchException (a TypeMismatchException)",d:["\"abc\" can't become Long."],c:{"ARGUMENTS|id":"\"abc\" → conversion failed"},f:"—",iv:"—"},
 {n:"dher",t:"400",w:"DefaultHandlerExceptionResolver → 400 Bad Request",d:["Your advice can catch MethodArgumentTypeMismatchException for a nicer message."],c:{"RESPONSE|status":"400 Bad Request"},f:"—",iv:"—"},
 {n:"negot",t:"406 vs 415",w:"HttpMediaTypeNotAcceptableException (406) vs HttpMediaTypeNotSupportedException (415)",
  d:["415: the server can't READ what you sent (Content-Type).","406: the server can't PRODUCE what you asked for (Accept)."],c:{},f:"—",iv:"415 is about Content-Type (request body); 406 is about Accept (response)."}
 ]},
// =====================================================================
{id:"advice", group:"Errors", name:"Business exception → @RestControllerAdvice → ProblemDetail",
 goal:"Your own exceptions turned into consistent error JSON.",
 steps:[
 {n:"ihm",t:"Service throws",w:"paymentService.refund(42) → throws PaymentNotFoundException",d:["Propagates out of your controller method."],c:{"RETURN VALUE|exception":"PaymentNotFoundException"},f:"—",iv:"—"},
 {n:"ds",t:"DispatcherServlet catches it",w:"doDispatch catch → processDispatchResult → processHandlerException",d:["The response is not committed yet, so an error body can still be written."],c:{},f:"—",iv:"—"},
 {n:"her",t:"Ask the resolvers in order",w:"HandlerExceptionResolverComposite",d:["1) ExceptionHandlerExceptionResolver 2) ResponseStatusExceptionResolver 3) DefaultHandlerExceptionResolver."],c:{},f:"—",iv:"—"},
 {n:"eher",t:"Find the @ExceptionHandler",w:"ExceptionHandlerExceptionResolver.getExceptionHandlerMethod",
  d:["First in PaymentController itself, then @ControllerAdvice beans in @Order.","Within one class the closest exception type wins; across advice beans the FIRST bean (by @Order) with any matching handler wins, even if a later bean has a closer match."],c:{"HANDLER|exception handler":"GlobalErrorHandler#notFound(PaymentNotFoundException)"},f:"—",iv:"—"},
 {n:"advice",t:"Your handler builds the body",w:"@ExceptionHandler PaymentNotFoundException → ProblemDetail.forStatusAndDetail(NOT_FOUND, …)",d:[],c:{"RESPONSE|status":"404","RESPONSE|body":"{type, title:\"Not Found\", status:404, detail:\"Payment 42 not found\", instance:\"/payments/42/refund\"}"},f:"—",iv:"—"},
 {n:"problem",t:"Standard format",w:"ProblemDetail → application/problem+json",d:["Spring's own exceptions use the same format if you extend ResponseEntityExceptionHandler or set spring.mvc.problemdetails.enabled=true."],c:{"RESPONSE|Content-Type":"application/problem+json"},f:"—",
  iv:"Use one @RestControllerAdvice + ProblemDetail so every error (yours and Spring's) has the same shape."},
 {n:"rser",t:"Alternative: @ResponseStatus",w:"@ResponseStatus(HttpStatus.NOT_FOUND) class PaymentNotFoundException",d:["Quick, but the body is Boot's default error JSON; less control."],c:{},f:"—",iv:"—"}
 ]},
// =====================================================================
{id:"e500", group:"Errors", name:"Unhandled exception → /error (and the Security trap)",
 goal:"What happens when no resolver handles an exception — the ERROR dispatch runs the filters again.",
 steps:[
 {n:"ihm",t:"NullPointerException in your code",w:"PaymentController.get → NPE",d:["No @ExceptionHandler for it."],c:{"RETURN VALUE|exception":"NullPointerException"},f:"—",iv:"—"},
 {n:"her",t:"No resolver handles it",w:"processHandlerException → all resolvers return null → exception re-thrown",d:[],c:{},f:"—",iv:"—"},
 {n:"errdisp",t:"Tomcat error dispatch",w:"StandardHostValve → forward to /error (DispatcherType.ERROR)",
  d:["The filter chain runs AGAIN for /error, including Spring Security.","Since Security 6 authorization applies to all dispatcher types."],c:{"REQUEST|dispatch":"ERROR → /error"},
  f:"If the rules don't allow /error for this caller (anonymous request, denyAll, path-specific authorities), the 500 turns into 401/403 and you lose the real error. A JWT-authenticated request normally stays authenticated on the ERROR dispatch (context kept in a request attribute).",iv:"Permit /error (or dispatcherTypeMatchers(ERROR)) in your SecurityFilterChain."},
 {n:"errdisp",t:"BasicErrorController renders",w:"BasicErrorController.error → DefaultErrorAttributes",d:["No stack trace or message by default (server.error.include-message=never)."],c:{"RESPONSE|status":"500","RESPONSE|body":"{timestamp, status:500, error:\"Internal Server Error\", path:\"/payments/42\"}"},f:"—",
  iv:"Unhandled exceptions become Boot's /error JSON. A catch-all @ExceptionHandler(Exception.class) gives you control — but rethrow AccessDeniedException there, or @PreAuthorize 403s become 500s."}
 ]},
// =====================================================================
{id:"interceptor", group:"Request handling", name:"HandlerInterceptor vs Filter vs AOP",
 goal:"Three places to put cross-cutting logic — and what each one can see.",
 steps:[
 {n:"webcfg",t:"Register an interceptor",w:"WebMvcConfigurer.addInterceptors(registry.addInterceptor(new TimingInterceptor()).addPathPatterns(\"/payments/**\"))",d:[],c:{"HANDLER|interceptors":"TimingInterceptor on /payments/**"},f:"Adding @EnableWebMvc to this class turns off Boot's MVC auto-config.",iv:"—"},
 {n:"hec",t:"preHandle",w:"TimingInterceptor.preHandle(request, response, handler)",d:["handler is the HandlerMethod: you know the controller class and method, can read its annotations.","Return false to stop (e.g. rate limit)."],c:{"HANDLER|start":"t0 stored in request attribute"},f:"—",iv:"—"},
 {n:"ihm",t:"Handler runs",w:"invokeAndHandle",d:[],c:{},f:"—",iv:"—"},
 {n:"hec",t:"afterCompletion",w:"TimingInterceptor.afterCompletion(…, ex)",d:["Runs even on exceptions; ex is the exception if it wasn't resolved."],c:{"HANDLER|log":"GET /payments/42 took 18 ms"},f:"—",iv:"—"},
 {n:"interceptor",t:"Which one to use?",w:"Filter vs HandlerInterceptor vs @Aspect",
  d:["Filter: servlet level, runs before the DispatcherServlet (before or after Spring Security depending on its order); a plain Filter bean runs for REQUEST dispatches only, a OncePerRequestFilter skips ERROR/ASYNC by default; sees only the servlet request (e.g. request logging, correlation id).","HandlerInterceptor: only MVC handler calls; knows the HandlerMethod (e.g. per-endpoint timing, audit).","@Aspect: any Spring bean method, not HTTP-specific (e.g. @Transactional-like behaviour on services)."],c:{},f:"—",
  iv:"Filter = servlet level, Interceptor = MVC handler level, AOP = bean method level."}
 ]},
// =====================================================================
{id:"async", group:"Request handling", name:"Async controller: CompletableFuture / Callable",
 goal:"Freeing the Tomcat thread while slow work runs, and what that means for ThreadLocals.",
 steps:[
 {n:"ihm",t:"Controller returns a future",w:"CompletableFuture<ReportResponse> report() { return reportService.buildAsync(); }",d:["Method returns immediately."],c:{"THREAD|handler thread":"http-nio-8081-exec-3","RETURN VALUE|type":"CompletableFuture (not done)"},f:"—",iv:"—"},
 {n:"wam",t:"Start async processing",w:"DeferredResultMethodReturnValueHandler (adaptCompletionStage → DeferredResult) → WebAsyncManager.startDeferredResultProcessing → request.startAsync()",
  d:["The Tomcat thread goes back to the pool; the response stays open."],c:{"THREAD|handler thread":"released","REQUEST|state":"async started"},f:"Timeout (spring.mvc.async.request-timeout) → AsyncRequestTimeoutException → 503.",iv:"Async MVC frees the request thread, not the work: the work still needs a thread somewhere."},
 {n:"taskexec",t:"Work runs elsewhere",w:"your executor (CompletableFuture) / MVC AsyncTaskExecutor (Callable)",
  d:["Callable: Spring Security's WebAsyncManagerIntegrationFilter propagates the SecurityContext.","CompletableFuture on your own executor: no SecurityContext/MDC unless you propagate them."],c:{"THREAD|worker":"task-2"},f:"—",iv:"—"},
 {n:"wam",t:"Streaming variants",w:"SseEmitter / ResponseBodyEmitter / StreamingResponseBody",d:["Keep the response open and send many chunks/events (e.g. payment status updates via Server-Sent Events).","Same async machinery; the emitter is completed or times out."],c:{},f:"—",iv:"—"},
 {n:"asyncdisp",t:"Result ready → dispatch again",w:"WebAsyncManager.setConcurrentResultAndDispatch → AsyncContext.dispatch (DispatcherType.ASYNC)",
  d:["Filters run again for the ASYNC dispatch (OncePerRequestFilter skips unless configured).","DispatcherServlet writes the result with the normal return value handling."],c:{"THREAD|handler thread":"http-nio-8081-exec-7 (another one)","RESPONSE|status":"200","RESPONSE|body":"{…report…}"},f:"—",iv:"—"}
 ]},
// =====================================================================
{id:"methodvalid", group:"Errors", name:"@RequestParam validation (method validation, 6.1+)",
 goal:"Constraints directly on parameters — and the old @Validated-on-class trap.",
 steps:[
 {n:"ihm",t:"Constraint on a parameter",w:"list(@RequestParam @Min(1) @Max(100) int size)",d:["GET /payments?size=500"],c:{"ARGUMENTS|size":"500"},f:"—",iv:"—"},
 {n:"valid",t:"Built-in method validation",w:"HandlerMethod has constraint annotations → MethodValidator (Spring 6.1+)",d:["Validates before invoking the controller."],c:{"VALIDATION|size":"must be ≤ 100"},f:"—",iv:"—"},
 {n:"dher",t:"400 with details",w:"HandlerMethodValidationException → DefaultHandlerExceptionResolver → 400",d:["Handle it in your advice for a ProblemDetail with field errors."],c:{"RESPONSE|status":"400"},f:"—",iv:"—"},
 {n:"advice",t:"The old way's trap",w:"@Validated on the controller class → MethodValidationPostProcessor AOP proxy → ConstraintViolationException",
  d:["That exception isn't mapped by MVC → 500 unless your advice handles it.","In 6.1+ drop class-level @Validated on controllers and let MVC's built-in method validation do it."],c:{},f:"—",iv:"Spring 6.1 validates controller parameters itself; class-level @Validated on controllers leads to ConstraintViolationException (500 by default)."}
 ]},
// =====================================================================
{id:"cors", group:"Request handling", name:"CORS: @CrossOrigin vs Spring Security's CorsFilter",
 goal:"Two places CORS can be handled — and why with Security the filter must do it.",
 steps:[
 {n:"client",t:"Browser preflight",w:"OPTIONS /payments, Origin: http://localhost:3000, Access-Control-Request-Method: POST",d:["No Authorization header on a preflight."],c:{"REQUEST|line":"OPTIONS /payments (preflight)"},f:"—",iv:"—"},
 {n:"cors",t:"MVC-level CORS",w:"@CrossOrigin on the controller / WebMvcConfigurer.addCorsMappings → AbstractHandlerMapping.getCorsHandlerExecutionChain → PreFlightHandler",
  d:["Works when the request reaches the DispatcherServlet.","But Spring Security runs first: the header-less preflight hits authentication → 401 before MVC sees it."],c:{"RESPONSE|status":"401 (Security blocked the preflight)"},f:"This is the classic 'CORS works without security, fails with it' bug.",iv:"—"},
 {n:"cors",t:"Security-level CORS",w:"http.cors(withDefaults()) → CorsFilter uses the CorsConfigurationSource bean",
  d:["http.cors() without a CorsConfigurationSource bean falls back to Spring MVC's CORS configuration (HandlerMappingIntrospector).","The filter answers the preflight before authentication."],c:{"RESPONSE|status":"200 + Access-Control-Allow-* headers"},f:"—",
  iv:"With Spring Security, enable http.cors() so CORS is handled in the filter chain before authentication.",z:[["security","cors",1,"CorsFilter in detail"]]}
 ]},
{id:"views", group:"Request handling", name:"@Controller + view vs @RestController",
 goal:"Where HTML rendering fits in doDispatch and why REST controllers skip it.",
 steps:[
 {n:"ihm",t:"@Controller returns a view name",w:"String showPayment(Model model) { model.addAttribute(\"p\", p); return \"payment\"; }",d:["ViewNameMethodReturnValueHandler stores the name in the ModelAndViewContainer."],c:{"RETURN VALUE|type":"view name \"payment\" + model"},f:"—",iv:"—"},
 {n:"views",t:"Render the view",w:"processDispatchResult → render → ViewResolver.resolveViewName → View.render (e.g. Thymeleaf)",d:["HTML is produced from the template and the model."],c:{"RESPONSE|Content-Type":"text/html"},f:"No template found → TemplateInputException / 500.",iv:"—"},
 {n:"body",t:"@RestController skips views",w:"@RestController = @Controller + @ResponseBody → RequestResponseBodyMethodProcessor",d:["The return value is written as the body; mavContainer.setRequestHandled(true), so no view is resolved."],c:{"RETURN VALUE|type":"object → JSON"},f:"—",iv:"@ResponseBody bypasses view resolution; the return value is serialised by a message converter."}
 ]},
{id:"binding", group:"Request handling", name:"Query object binding: @ModelAttribute and @InitBinder",
 goal:"How ?status=COMPLETED&from=2026-09-01 becomes a search object.",
 steps:[
 {n:"client",t:"Search request",w:"GET /payments?status=COMPLETED&from=2026-09-01&page=0&size=20",d:[],c:{"REQUEST|line":"GET /payments?status=COMPLETED&from=2026-09-01"},f:"—",iv:"—"},
 {n:"argres",t:"Non-annotated object parameter",w:"search(PaymentSearch criteria, Pageable pageable) → ServletModelAttributeMethodProcessor",d:["A simple object parameter without annotation is treated as @ModelAttribute: request params are bound to its properties/constructor."],c:{"ARGUMENTS|criteria":"PaymentSearch(status=?, from=?)"},f:"—",iv:"—"},
 {n:"conv",t:"Data binding",w:"WebDataBinder.bind → ConversionService (String → enum, String → LocalDate)",d:["@InitBinder methods in the controller/advice can customise the binder (allowed fields, custom editors).","Pageable comes from PageableHandlerMethodArgumentResolver (Spring Data web support)."],c:{"ARGUMENTS|criteria":"PaymentSearch(status=COMPLETED, from=2026-09-01)","ARGUMENTS|pageable":"page 0, size 20"},f:"Invalid value → BindException / MethodArgumentNotValidException (with @Valid) → 400.",iv:"Query params bind to objects via @ModelAttribute data binding; the JSON body binds via message converters — two different mechanisms."}
 ]},
{id:"testing", group:"Startup", name:"Testing MVC: @WebMvcTest + MockMvc",
 goal:"Running the real DispatcherServlet path in a test without starting Tomcat.",
 steps:[
 {n:"ds",t:"Slice context",w:"@WebMvcTest(PaymentController.class) → MVC auto-config + your controller + advice + filters (incl. security)",d:["Services are not loaded: @MockitoBean PaymentService paymentService."],c:{"HANDLER|beans":"paymentController, advice, mock paymentService"},f:"—",iv:"—"},
 {n:"hm",t:"MockMvc performs the request",w:"mockMvc.perform(post(\"/payments\").contentType(JSON).content(json).with(jwt()))",
  d:["Goes through filters and DispatcherServlet in memory (no socket).","with(jwt()) from spring-security-test fakes an authenticated JWT."],c:{"REQUEST|line":"POST /payments (MockMvc)"},f:"—",iv:"—"},
 {n:"dher",t:"Assert the result",w:"andExpect(status().isCreated()).andExpect(jsonPath(\"$.status\").value(\"PENDING\"))",d:["Test 400/401/403 paths the same way — exactly the failure tests still missing in the project."],c:{"RESPONSE|status":"201 (asserted)"},f:"—",
  iv:"@WebMvcTest + MockMvc tests mapping, validation, JSON, security and error handling fast; @SpringBootTest + real HTTP for full integration."}
 ]}
];