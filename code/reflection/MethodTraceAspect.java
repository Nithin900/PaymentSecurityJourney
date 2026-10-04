package org.example.debug;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * Learning tool: logs every call into our own beans while the app runs:
 * which method, its inputs, its output (or exception) and how long it took.
 * Needs spring-boot-starter-aop. Runs ONLY with the dev profile.
 */
@Aspect
@Component
@Profile("dev")
public class MethodTraceAspect {

    private static final Logger log = LoggerFactory.getLogger(MethodTraceAspect.class);

    @Around("execution(* org.example..*.*(..))"
            + " && !within(org.example.debug..*)"
            + " && !@within(org.springframework.context.annotation.Configuration)")
    public Object trace(ProceedingJoinPoint jp) throws Throwable {
        MethodSignature sig = (MethodSignature) jp.getSignature();      // reflection data about the method
        String method = sig.getDeclaringType().getSimpleName() + "." + sig.getName();

        log.info("-> {}  inputs: {}", method, inputs(sig.getParameterNames(), jp.getArgs()));
        long start = System.nanoTime();
        try {
            Object result = jp.proceed();                                // the real method runs here
            log.info("<- {}  output: {}  ({} ms)", method, safe(result), ms(start));
            return result;
        } catch (Throwable t) {
            log.info("x  {}  threw {}: {}  ({} ms)", method,
                    t.getClass().getSimpleName(), safe(t.getMessage()), ms(start));
            throw t;
        }
    }

    private String inputs(String[] names, Object[] values) {
        StringBuilder sb = new StringBuilder("{");
        for (int i = 0; i < values.length; i++) {
            String name = (names != null && i < names.length) ? names[i] : "arg" + i;
            sb.append(i == 0 ? "" : ", ").append(name).append("=").append(safe(values[i]));
        }
        return sb.append("}").toString();
    }

    /** Masks long numbers (account/card numbers) except the last 4 digits, and keeps logs short. */
    private String safe(Object value) {
        if (value == null) return "null";
        String s = String.valueOf(value).replaceAll("\\d(?=\\d{4})", "*");
        return s.length() > 200 ? s.substring(0, 200) + "..." : s;
    }

    private long ms(long start) {
        return (System.nanoTime() - start) / 1_000_000;
    }
}
