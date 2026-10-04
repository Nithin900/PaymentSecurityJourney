import java.lang.annotation.*;
import java.lang.reflect.*;

// ---------- A tiny "secure payment" project ----------

@Retention(RetentionPolicy.RUNTIME) @interface Service {}
@Retention(RetentionPolicy.RUNTIME) @interface Secured { String role(); }
@Retention(RetentionPolicy.RUNTIME) @interface Sensitive {}

@Service
class PaymentService {
    @Sensitive private String apiSecretKey = "sk_live_9f8a7b6c";
    @Sensitive private String cardNumber   = "4111111111111111";
    private double balance = 500.00;

    @Secured(role = "ADMIN")
    public String refund(double amount) { balance += amount; return "Refunded " + amount; }

    @Secured(role = "USER")
    public String pay(double amount) { balance -= amount; return "Paid " + amount; }

    private boolean fraudCheck(double amount) { return amount > 10_000; }
}

// ---------- The reflection "flashlight" ----------

public class PaymentReflectionDemo {
    public static void main(String[] args) throws Exception {
        Class<?> c = Class.forName("PaymentService");

        System.out.println("=== 1. BLUEPRINT (what reflection sees) ===");
        System.out.println("Class      : " + c.getName());
        System.out.println("Is @Service: " + c.isAnnotationPresent(Service.class));

        System.out.println("\nFields:");
        for (Field f : c.getDeclaredFields())
            System.out.println("  " + Modifier.toString(f.getModifiers()) + " " +
                f.getType().getSimpleName() + " " + f.getName() +
                (f.isAnnotationPresent(Sensitive.class) ? "   <-- @Sensitive" : ""));

        System.out.println("\nMethods:");
        for (Method m : c.getDeclaredMethods()) {
            Secured s = m.getAnnotation(Secured.class);
            System.out.println("  " + Modifier.toString(m.getModifiers()) + " " +
                m.getName() + "(" + m.getParameterTypes()[0].getSimpleName() + ")" +
                (s != null ? "   requires role: " + s.role() : "   (no security rule!)"));
        }

        System.out.println("\n=== 2. WHAT A FRAMEWORK DOES (like Spring) ===");
        Object service = c.getDeclaredConstructor().newInstance();
        String currentUserRole = "USER";
        for (String name : new String[]{"pay", "refund"}) {
            Method m = c.getMethod(name, double.class);
            String needed = m.getAnnotation(Secured.class).role();
            if (needed.equals(currentUserRole))
                System.out.println("  ALLOWED " + name + " -> " + m.invoke(service, 100.0));
            else
                System.out.println("  DENIED  " + name + " (needs " + needed + ", user is " + currentUserRole + ")");
        }

        System.out.println("\n=== 3. THE DANGER (why security courses warn you) ===");
        Field secret = c.getDeclaredField("apiSecretKey");
        secret.setAccessible(true);                       // breaks 'private'
        System.out.println("  Leaked private secret: " + secret.get(service));

        Method fraud = c.getDeclaredMethod("fraudCheck", double.class);
        fraud.setAccessible(true);
        System.out.println("  Called private fraudCheck(50000): " + fraud.invoke(service, 50000.0));

        Field balance = c.getDeclaredField("balance");
        balance.setAccessible(true);
        balance.set(service, 1_000_000.0);                // tamper with state
        System.out.println("  Balance tampered to: " + balance.get(service));
    }
}
