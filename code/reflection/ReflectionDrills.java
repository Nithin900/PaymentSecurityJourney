import java.lang.annotation.*;
import java.lang.reflect.*;
import java.util.*;

// Run: java ReflectionDrills.java
// Each drill prints a result. Then delete the body of a drill and rewrite it from memory.
public class ReflectionDrills {

    public static void main(String[] args) throws Exception {
        drill1_threeWaysToGetAClass();
        drill2_publicVsDeclared();
        drill3_readAnnotationValue();
        drill4_unwrapInvocationTargetException();
        drill5_genericsSurviveInDeclarations();
        drill6_constructWithArguments();
    }

    // 1. Payment.class, obj.getClass(), Class.forName(...) give the SAME object
    static void drill1_threeWaysToGetAClass() throws Exception {
        Class<?> a = Payment.class;
        Class<?> b = new Payment("PAY-1", "ACC-778899", 250.0).getClass();
        Class<?> c = Class.forName("Payment");
        System.out.println("1) same Class object? " + (a == b && b == c));
    }

    // 2. getMethods = public + inherited; getDeclaredMethods = all visibilities, this class only
    static void drill2_publicVsDeclared() {
        Method[] pub = PaymentServiceImpl.class.getMethods();
        Method[] dec = PaymentServiceImpl.class.getDeclaredMethods();
        System.out.println("2) getMethods=" + pub.length + " (includes Object's toString, hashCode...)"
            + "  getDeclaredMethods=" + dec.length + " " + names(dec));
    }

    // 3. Read @PreAuthorize("...") the way Spring Security does
    static void drill3_readAnnotationValue() throws Exception {
        Method m = PaymentServiceImpl.class.getMethod("createPayment", Payment.class);
        PreAuthorize rule = m.getAnnotation(PreAuthorize.class);
        System.out.println("3) createPayment rule = " + rule.value());
        Object generic = rule.annotationType().getMethod("value").invoke(rule); // without knowing the type
        System.out.println("   read generically   = " + generic);
    }

    // 4. Method.invoke wraps the real exception
    static void drill4_unwrapInvocationTargetException() throws Exception {
        Method m = PaymentServiceImpl.class.getMethod("createPayment", Payment.class);
        try {
            m.invoke(new PaymentServiceImpl(), new Payment("PAY-2", "ACC-1", -5));
        } catch (InvocationTargetException e) {
            System.out.println("4) wrapper: " + e.getClass().getSimpleName() + " message=" + e.getMessage());
            System.out.println("   real   : " + e.getCause());
        }
    }

    // 5. Generics are erased, except in declarations (how Spring Data knows the entity type)
    static void drill5_genericsSurviveInDeclarations() {
        Type t = PaymentRepository.class.getGenericInterfaces()[0];
        System.out.println("5) PaymentRepository extends " + t.getTypeName());
    }

    // 6. Build an object through a constructor with arguments (what Spring does for injection)
    static void drill6_constructWithArguments() throws Exception {
        Constructor<Payment> ctor = Payment.class.getDeclaredConstructor(String.class, String.class, double.class);
        Payment p = ctor.newInstance("PAY-3", "ACC-555", 99.0);
        Field amount = Payment.class.getDeclaredField("amount");
        amount.setAccessible(true);
        System.out.println("6) built " + p + ", private amount read = " + amount.get(p));
    }

    static List<String> names(Method[] ms) {
        List<String> l = new ArrayList<>(); for (Method m : ms) l.add(m.getName()); Collections.sort(l); return l;
    }
}

@Retention(RetentionPolicy.RUNTIME) @interface PreAuthorize { String value(); }

class Payment {
    private final String paymentId; private final String accountNumber; private final double amount;
    Payment(String id, String acc, double amount) { this.paymentId = id; this.accountNumber = acc; this.amount = amount; }
    double amount() { return amount; }
    public String toString() { return "Payment[" + paymentId + "]"; }
}

interface Repository<T, ID> {}
interface PaymentRepository extends Repository<Payment, String> {}

class PaymentServiceImpl {
    @PreAuthorize("hasAuthority('SCOPE_payment.write')")
    public String createPayment(Payment p) {
        if (p.amount() <= 0) throw new IllegalArgumentException("amount must be positive");
        return "created " + p;
    }
    @PreAuthorize("hasAuthority('SCOPE_payment.read')")
    public String getPayment(String id) { return "found " + id; }
    private boolean fraudCheck(Payment p) { return p.amount() > 10_000; }
}
