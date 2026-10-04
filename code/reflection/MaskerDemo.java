import java.lang.annotation.*;
import java.lang.reflect.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

// Run: java MaskerDemo.java
// Production pattern: mark fields @Sensitive, mask them in logs. Reflection runs once per class (cached).
public class MaskerDemo {
    public static void main(String[] args) {
        Payment p = new Payment("PAY-1001", "ACC-778899", "4111111111111111", 250.00, "nithin");
        System.out.println("toString (unsafe): " + p.unsafeToString());
        System.out.println("Masker   (safe)  : " + Masker.describe(p));
        System.out.println("cached classes   : " + Masker.CACHE.keySet());
    }
}

@Retention(RetentionPolicy.RUNTIME) @Target(ElementType.FIELD) @interface Sensitive {}

class Payment {
    private final String paymentId;
    @Sensitive private final String accountNumber;
    @Sensitive private final String cardNumber;
    private final double amount;
    private final String owner;
    Payment(String id, String acc, String card, double amount, String owner) {
        this.paymentId = id; this.accountNumber = acc; this.cardNumber = card; this.amount = amount; this.owner = owner;
    }
    String unsafeToString() { return paymentId + " " + accountNumber + " " + cardNumber + " " + amount; }
}

final class Masker {
    static final Map<Class<?>, List<Field>> CACHE = new ConcurrentHashMap<>();

    static String describe(Object o) {
        List<Field> fields = CACHE.computeIfAbsent(o.getClass(), c -> {
            List<Field> list = new ArrayList<>();
            for (Field f : c.getDeclaredFields())
                if (!Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); list.add(f); }
            return list;
        });
        StringJoiner out = new StringJoiner(", ", o.getClass().getSimpleName() + "[", "]");
        for (Field f : fields) {
            try {
                String v = String.valueOf(f.get(o));
                if (f.isAnnotationPresent(Sensitive.class)) v = "****" + v.substring(Math.max(0, v.length() - 4));
                out.add(f.getName() + "=" + v);
            } catch (IllegalAccessException e) { out.add(f.getName() + "=?"); }
        }
        return out.toString();
    }
}
