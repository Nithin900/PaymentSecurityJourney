import java.lang.annotation.*;
import java.lang.reflect.*;

// Run: java BreakItLab.java
// Every reflection failure from Stage 5 that you can trigger without Spring. Read each error, then the fix.
public class BreakItLab {
    public static void main(String[] args) {
        run("ClassNotFoundException",   () -> Class.forName("org.example.Paymnet"));
        run("NoSuchMethodException",    () -> Svc.class.getMethod("pay", Double.class));       // needs double.class
        run("NoSuchMethodException",    () -> Svc.class.getMethod("fraudCheck", double.class)); // private: use getDeclaredMethod
        run("IllegalAccessException",   () -> Svc.class.getDeclaredMethod("fraudCheck", double.class).invoke(new Svc(), 1.0));
        run("IllegalArgumentException", () -> Svc.class.getMethod("pay", double.class).invoke(new Svc(), "100"));
        run("InvocationTargetException",() -> Svc.class.getMethod("pay", double.class).invoke(new Svc(), -1.0));
        run("InaccessibleObjectException", () -> { String.class.getDeclaredField("value").setAccessible(true); return null; });
        run("NoSuchMethodException (no no-arg constructor, Hibernate's error)",
                                        () -> NoDefaultCtor.class.getDeclaredConstructor().newInstance());
        System.out.println("\nSILENT failure: annotation with CLASS retention");
        System.out.println("  @Runtime present?  " + Svc.class.isAnnotationPresent(RuntimeTag.class));
        System.out.println("  @ClassOnly present? " + Svc.class.isAnnotationPresent(ClassOnlyTag.class) + "   <- no error, just false");
    }

    interface Step { Object go() throws Exception; }
    static void run(String expected, Step s) {
        try { s.go(); System.out.println("no error?! expected " + expected); }
        catch (InvocationTargetException e) {
            System.out.println("[" + e.getClass().getSimpleName() + "] real cause -> " + e.getCause());
        } catch (Exception e) {
            System.out.println("[" + e.getClass().getSimpleName() + "] " + e.getMessage());
        }
    }
}

@Retention(RetentionPolicy.RUNTIME) @interface RuntimeTag {}
@Retention(RetentionPolicy.CLASS)   @interface ClassOnlyTag {}

@RuntimeTag @ClassOnlyTag
class Svc {
    public String pay(double amount) {
        if (amount <= 0) throw new IllegalArgumentException("amount must be positive");
        return "Paid " + amount;
    }
    private boolean fraudCheck(double amount) { return amount > 10_000; }
}

class NoDefaultCtor { NoDefaultCtor(String id) {} }
