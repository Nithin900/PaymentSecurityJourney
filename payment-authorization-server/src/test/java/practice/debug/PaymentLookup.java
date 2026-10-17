package practice.debug;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Debug exercise C. A tiny version of Build step 10: cache payments without leaking them.
 * One bug is planted here. Find it with the debugger first, then fix it.
 */
public class PaymentLookup {

    public record Payment(long id, String owner, long amountCents) { }

    public interface PaymentStore {
        Optional<Payment> findByIdAndOwner(long id, String owner);
    }

    private final PaymentStore store;
    private final Map<String, Payment> cache = new ConcurrentHashMap<>();

    public PaymentLookup(PaymentStore store) {
        this.store = store;
    }

    public Optional<Payment> find(String owner, long paymentId) {
        String key = cacheKey(owner, paymentId);
        Payment hit = cache.get(key);
        if (hit != null) {
            return Optional.of(hit);
        }
        Optional<Payment> loaded = store.findByIdAndOwner(paymentId, owner);
        loaded.ifPresent(p -> cache.put(key, p));
        return loaded;
    }

    public void evict(String owner, long paymentId) {
        cache.remove(cacheKey(owner, paymentId));
    }

    String cacheKey(String owner, long paymentId) {
        return "payment:" + owner + paymentId;
    }
}
