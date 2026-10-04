package org.example.debug;

import jakarta.persistence.EntityManagerFactory;
import org.springframework.aop.support.AopUtils;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.config.ConfigurableListableBeanFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.util.ClassUtils;

import java.lang.reflect.AnnotatedElement;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.util.Arrays;
import java.util.stream.Collectors;

/**
 * Learning tool: prints the "blueprint" of Payment Service B at startup using reflection.
 * Runs ONLY with the dev profile (spring.profiles.active=dev). Prints names, never values.
 */
@Component
@Profile("dev")
public class ReflectionReport implements ApplicationRunner {

    private static final String BASE_PACKAGE = "org.example";

    private final ConfigurableListableBeanFactory factory;
    private final ObjectProvider<EntityManagerFactory> emf;

    public ReflectionReport(ConfigurableListableBeanFactory factory,
                            ObjectProvider<EntityManagerFactory> emf) {
        this.factory = factory;
        this.emf = emf;
    }

    @Override
    public void run(ApplicationArguments args) {
        System.out.println("\n================ REFLECTION REPORT ================");

        // 1. Beans: classes, annotations, fields, methods, who-injects-whom
        for (String name : factory.getBeanDefinitionNames()) {
            Object bean;
            try { bean = factory.getBean(name); }
            catch (Exception notCreatableHere) { continue; } // abstract or request-scoped beans
            Class<?> type = realClass(bean);
            if (type == null || type == ReflectionReport.class) continue;

            System.out.println("\nBEAN  " + name + "  ->  " + type.getSimpleName()
                    + (AopUtils.isAopProxy(bean) ? "   [wrapped in a proxy]" : ""));
            System.out.println("  class annotations: " + annotations(type));

            for (Field f : type.getDeclaredFields()) {
                if (Modifier.isStatic(f.getModifiers())) continue;
                System.out.println("  field  " + Modifier.toString(f.getModifiers()) + " "
                        + f.getType().getSimpleName() + " " + f.getName() + "  " + annotations(f));
            }
            for (Method m : type.getDeclaredMethods()) {
                if (m.isSynthetic()) continue; // skip compiler-generated lambdas
                System.out.println("  method " + Modifier.toString(m.getModifiers()) + " "
                        + m.getName() + "(" + params(m) + ")  " + annotations(m));
            }

            String deps = Arrays.stream(factory.getDependenciesForBean(name))
                    .filter(d -> d.startsWith(BASE_PACKAGE) || isOurs(d))
                    .collect(Collectors.joining(", "));
            if (!deps.isEmpty()) System.out.println("  injected with: " + deps);
        }

        // 2. JPA entities are not beans, so ask Hibernate's metamodel for them
        EntityManagerFactory factoryJpa = emf.getIfAvailable();
        if (factoryJpa != null) {
            factoryJpa.getMetamodel().getEntities().forEach(e -> {
                Class<?> type = e.getJavaType();
                if (!type.getName().startsWith(BASE_PACKAGE)) return;
                System.out.println("\nENTITY " + type.getSimpleName() + "  " + annotations(type));
                for (Field f : type.getDeclaredFields())
                    System.out.println("  column " + f.getType().getSimpleName() + " "
                            + f.getName() + "  " + annotations(f));
            });
        }
        System.out.println("\n===================================================\n");
    }

    private boolean isOurs(String beanName) {
        try { return factory.containsBean(beanName) && realClass(factory.getBean(beanName)) != null; }
        catch (Exception e) { return false; }
    }

    /** Unwraps proxies; returns null if the bean is not one of our own classes. */
    private Class<?> realClass(Object bean) {
        Class<?> target = AopUtils.getTargetClass(bean);
        if (target.getName().startsWith(BASE_PACKAGE)) return ClassUtils.getUserClass(target);
        // Spring Data repositories: the class is Spring's, but the interface is ours
        for (Class<?> i : ClassUtils.getAllInterfacesForClass(bean.getClass()))
            if (i.getName().startsWith(BASE_PACKAGE)) return i;
        return null;
    }

    private String annotations(AnnotatedElement el) {
        return Arrays.stream(el.getAnnotations())
                .map(a -> "@" + a.annotationType().getSimpleName() + valueOf(a))
                .collect(Collectors.joining(" "));
    }

    /** Reads an annotation's value() attribute using reflection, e.g. @PreAuthorize("..."). */
    private String valueOf(java.lang.annotation.Annotation a) {
        try {
            Object v = a.annotationType().getMethod("value").invoke(a);
            if (v instanceof String s && !s.isEmpty()) return "(\"" + s + "\")";
            if (v instanceof String[] arr && arr.length > 0) return Arrays.toString(arr);
        } catch (ReflectiveOperationException ignored) { }
        return "";
    }

    private String params(Method m) {
        return Arrays.stream(m.getParameterTypes()).map(Class::getSimpleName)
                .collect(Collectors.joining(", "));
    }
}
