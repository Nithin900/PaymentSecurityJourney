# Reflection in SecurePay

Practice files for the [Reflection Workbench](../../site/reflection.html) page.

The first five run on Java 17 with no build step.

| File | What it does | Where it goes / how to run |
|---|---|---|
| `PaymentReflectionDemo.java` | Reads a payment class's blueprint, enforces a role from an annotation, then breaks `private`. | `java PaymentReflectionDemo.java` (add `ADMIN` to switch role) |
| `ReflectionDrills.java` | Six API drills: Class objects, public vs declared, annotation values, InvocationTargetException, generics, constructors. | `java ReflectionDrills.java` |
| `ProxyDemo.java` | JDK dynamic proxy doing @PreAuthorize-style checks and call tracing; shows the self-invocation gap. | `java ProxyDemo.java` |
| `MaskerDemo.java` | `@Sensitive` field masking with a per-class reflection cache. | `java MaskerDemo.java` |
| `BreakItLab.java` | Triggers eight reflection failures plus the silent CLASS-retention one. | `java BreakItLab.java` |
| `ReflectionReport.java` | Prints every bean's class, annotations, fields, methods and dependencies, plus JPA entities, at startup. | `payment-service-b/src/main/java/org/example/debug/` |
| `MethodTraceAspect.java` | Logs each call into `org.example` beans: inputs, output or exception, time. Masks long digit runs. | Same folder. Needs `spring-boot-starter-aop`. |

Both Spring classes are `@Profile("dev")`. Run Service B with `spring.profiles.active=dev`; never enable them in production.
