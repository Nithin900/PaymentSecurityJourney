import java.lang.annotation.*;
import java.lang.reflect.*;

// Run: java PaymentReflectionDemo.java   (Java 11+, no compile step)
public class PaymentReflectionDemo {
    public static void main(String[] args) throws Exception {
        Class<?> c = Class.forName("PaymentService");

        System.out.println("=== 1. BLUEPRINT ===");
        System.out.println("Class      : " + c.getName());
        System.out.println("Is @Service: " + c.isAnnotationPresent(Service.class));
        System.out.println("Fields:");
        for (Field f : c.getDeclaredFields())
            System.out.println("  " + Modifier.toString(f.getModifiers()) + " " + f.getType().getSimpleName()
                + " " + f.getName() + (f.isAnnotationPresent(Sensitive.class) ? "   <-- @Sensitive" : ""));
        System.out.println("Methods:");
        for (Method m : c.getDeclaredMethods()) {
            Secured s = m.getAnnotation(Secured.class);
            System.out.println("  " + Modifier.toString(m.getModifiers()) + " " + m.getName()
                + params(m) + (s != null ? "   requires " + s.role() : "   (no rule!)"));
        }

        System.out.println("\n=== 2. WHAT SPRING DOES ===");
        Object service = c.getDeclaredConstructor().newInstance();
        String role = args.length > 0 ? args[0] : "USER";          // try: java PaymentReflectionDemo.java ADMIN
        for (String name : new String[]{"pay", "refund"}) {
            Method m = c.getMethod(name, double.class);
            String needed = m.getAnnotation(Secured.class).role();
            System.out.println(needed.equals(role)
                ? "  ALLOWED " + name + " -> " + m.invoke(service, 100.0)
                : "  DENIED  " + name + " (needs " + needed + ", user is " + role + ")");
        }

        System.out.println("\n=== 3. THE DANGER ===");
        Field secret = c.getDeclaredField("apiSecretKey");
        secret.setAccessible(true);
        System.out.println("  Leaked secret      : " + secret.get(service));
        Method fraud = c.getDeclaredMethod("fraudCheck", double.class);
        fraud.setAccessible(true);
        System.out.println("  fraudCheck(50000)  : " + fraud.invoke(service, 50000.0));
        Field balance = c.getDeclaredField("balance");
        balance.setAccessible(true);
        balance.set(service, 1_000_000.0);
        System.out.println("  Balance tampered to: " + balance.get(service));
    }

    static String params(Method m) {
        StringBuilder sb = new StringBuilder("(");
        for (Class<?> p : m.getParameterTypes()) sb.append(sb.length() > 1 ? ", " : "").append(p.getSimpleName());
        return sb.append(")").toString();
    }
}

@Retention(RetentionPolicy.RUNTIME) @interface Service {}
@Retention(RetentionPolicy.RUNTIME) @interface Secured { String role(); }
@Retention(RetentionPolicy.RUNTIME) @interface Sensitive {}

@Service
class PaymentService {
    @Sensitive private String apiSecretKey = "sk_live_9f8a7b6c";
    @Sensitive private String cardNumber   = "4111111111111111";
    private double balance = 500.00;

    @Secured(role = "ADMIN") public String refund(double amount) { balance += amount; return "Refunded " + amount; }
    @Secured(role = "USER")  public String pay(double amount)    { balance -= amount; return "Paid " + amount; }
    private boolean fraudCheck(double amount) { return amount > 10_000; }
}
