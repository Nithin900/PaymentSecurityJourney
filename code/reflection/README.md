# Reflection in SecurePay

Practice files for the [Reflection Workbench](../../site/reflection.html) page.

| File | What it does | Where it goes |
|---|---|---|
| `PaymentReflectionDemo.java` | Standalone demo: reads a payment class's blueprint, enforces a role from an annotation, then breaks `private`. | Run anywhere: `javac PaymentReflectionDemo.java && java PaymentReflectionDemo` |
| `ReflectionReport.java` | Prints every bean's class, annotations, fields, methods and dependencies, plus JPA entities, at startup. | `payment-service-b/src/main/java/org/example/debug/` |
| `MethodTraceAspect.java` | Logs each call into `org.example` beans: inputs, output or exception, time. Masks long digit runs. | Same folder. Needs `spring-boot-starter-aop`. |

Both Spring classes are `@Profile("dev")`. Run Service B with `spring.profiles.active=dev`; never enable them in production.
