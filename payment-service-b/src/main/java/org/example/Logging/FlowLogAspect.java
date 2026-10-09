package org.example.Logging;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Pointcut;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Logs every call into the classes below as "-> Class.method" and "<- Class.method (N ms)".
 * The lines carry the trace id, so `watch-logs.ps1 -Match <traceId>` lists the classes one request went through, in order.
 * Arguments are not logged on purpose (they hold account numbers and amounts).
 */
@Aspect
@Component
public class FlowLogAspect {

    private static final Logger log = LoggerFactory.getLogger("request.flow");

    @Pointcut("execution(* org.example.Controller..*.*(..)) || execution(* org.example.Service..*.*(..)) || execution(* org.example.Notification.NotificationListener.*(..))")
    void traced() {}

    @Around("traced()")
    public Object logCall(ProceedingJoinPoint pjp) throws Throwable {
        String name = pjp.getSignature().getDeclaringType().getSimpleName() + "." + pjp.getSignature().getName();
        log.info("-> {}", name);
        long start = System.nanoTime();
        try {
            Object result = pjp.proceed();
            log.info("<- {} ({} ms)", name, (System.nanoTime() - start) / 1_000_000);
            return result;
        } catch (Throwable t) {
            log.info("!! {} threw {} ({} ms)", name, t.getClass().getSimpleName(), (System.nanoTime() - start) / 1_000_000);
            throw t;
        }
    }
}
