import java.lang.annotation.*;
import java.lang.reflect.*;
import java.util.*;

// Run: java ProxyDemo.java
// Builds what Spring builds for @PreAuthorize + your MethodTraceAspect, with a plain JDK proxy.
public class ProxyDemo {

    public static void main(String[] args) {
        PaymentService real = new PaymentServiceImpl();
        PaymentService user  = secure(real, Set.of("SCOPE_payment.read"));
        PaymentService admin = secure(real, Set.of("SCOPE_payment.read", "SCOPE_payment.write"));

        System.out.println("proxy class: " + user.getClass().getName() + "\n");
        System.out.println("--- user with read scope only");
        call(() -> user.getPayment("PAY-1001"));
        call(() -> user.createPayment("PAY-2002", 250.00));
        System.out.println("\n--- admin with write scope");
        call(() -> admin.createPayment("PAY-2002", 250.00));
        System.out.println("\n--- self-invocation: createAndAudit calls this.getPayment() inside");
        call(() -> admin.createAndAudit("PAY-3003", 10.00));
        System.out.println("   ^ only ONE trace line: the inner getPayment never went through the proxy");
    }

    @SuppressWarnings("unchecked")
    static <T> T secure(T target, Set<String> scopes) {
        InvocationHandler h = (proxy, method, args) -> {
            Method impl = target.getClass().getMethod(method.getName(), method.getParameterTypes());
            String name = target.getClass().getSimpleName() + "." + method.getName();
            System.out.println("-> " + name + " inputs=" + Arrays.toString(args));          // trace: inputs
            PreAuthorize rule = impl.getAnnotation(PreAuthorize.class);                       // security: read annotation
            if (rule != null && !scopes.contains(rule.value()))
                throw new SecurityException("403 Forbidden: needs " + rule.value());
            long t = System.nanoTime();
            try {
                Object out = method.invoke(target, args);                                      // the real method
                System.out.println("<- " + name + " output=" + out + " (" + (System.nanoTime() - t) / 1000 + " us)");
                return out;
            } catch (InvocationTargetException e) { throw e.getCause(); }
        };
        return (T) Proxy.newProxyInstance(target.getClass().getClassLoader(),
                                          target.getClass().getInterfaces(), h);
    }

    static void call(java.util.function.Supplier<Object> s) {
        try { s.get(); } catch (SecurityException e) { System.out.println("x  " + e.getMessage()); }
    }
}

@Retention(RetentionPolicy.RUNTIME) @interface PreAuthorize { String value(); }

interface PaymentService {
    String getPayment(String id);
    String createPayment(String id, double amount);
    String createAndAudit(String id, double amount);
}

class PaymentServiceImpl implements PaymentService {
    @PreAuthorize("SCOPE_payment.read")
    public String getPayment(String id) { return "Payment[" + id + "]"; }

    @PreAuthorize("SCOPE_payment.write")
    public String createPayment(String id, double amount) { return "Created " + id + " for " + amount; }

    @PreAuthorize("SCOPE_payment.write")
    public String createAndAudit(String id, double amount) {
        return "Created " + id + ", audit saw " + this.getPayment(id);   // 'this' = real object, not proxy
    }
}
