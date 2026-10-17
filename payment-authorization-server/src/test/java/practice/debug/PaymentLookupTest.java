package practice.debug;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import practice.debug.PaymentLookup.Payment;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("C - debug: cached payments must not leak between users")
class PaymentLookupTest {

    /** Fake database that counts how often it is asked. */
    static class FakeStore implements PaymentLookup.PaymentStore {
        final List<Payment> rows = List.of(
                new Payment(123, "nithin", 50_00),
                new Payment(7, "alice", 20_00));
        int calls;

        @Override
        public Optional<Payment> findByIdAndOwner(long id, String owner) {
            calls++;
            return rows.stream().filter(p -> p.id() == id && p.owner().equals(owner)).findFirst();
        }
    }

    FakeStore store;
    PaymentLookup lookup;

    @BeforeEach
    void setUp() {
        store = new FakeStore();
        lookup = new PaymentLookup(store);
    }

    @Test
    @DisplayName("C1 the second lookup comes from the cache")
    void secondLookupIsCached() {
        lookup.find("nithin", 123);
        lookup.find("nithin", 123);
        assertThat(store.calls).isEqualTo(1);
    }

    @Test
    @DisplayName("C2 alice cannot read nithin's payment")
    void aliceCannotReadNithins() {
        lookup.find("nithin", 123);
        assertThat(lookup.find("alice", 123)).isEmpty();
    }

    @Test
    @DisplayName("C3 user 'nithin1' asking for payment 23 must not get nithin's payment 123")
    void noLeakBetweenSimilarNames() {
        lookup.find("nithin", 123);
        assertThat(lookup.find("nithin1", 23)).isEmpty();
    }

    @Test
    @DisplayName("C4 after evict, the next lookup goes to the database again")
    void evictReloads() {
        lookup.find("nithin", 123);
        lookup.evict("nithin", 123);
        lookup.find("nithin", 123);
        assertThat(store.calls).isEqualTo(2);
    }
}
