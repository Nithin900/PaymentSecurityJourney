var NODES = [
 // ---- producer ----
 ["kt","KafkaTemplate","send(topic, key, value)",20,45,200,"prod","Spring's producer API. Returns CompletableFuture<SendResult> (Spring Kafka 3.x): the send is asynchronous."],
 ["ser","Serializer","JsonSerializer / StringSerializer",20,85,200,"prod","Turns key and value into bytes. JsonSerializer adds type info headers by default."],
 ["part","Partitioner","key hash → partition",20,125,200,"prod","Same key → same partition (murmur2 hash % partitions) → ordered per key. Null key → sticky partitioning (a batch goes to one partition, then it switches)."],
 ["acc","Record accumulator","batches per partition",20,165,200,"prod","Buffers records into batches (batch.size, linger.ms) to send fewer, bigger requests."],
 ["sender","Sender thread","network I/O",20,205,200,"prod","Background thread that ships batches to partition leaders and handles retries."],
 ["ack","Broker ack","acks=all, idempotence",20,245,200,"prod","Kafka clients 3.x defaults: acks=all and enable.idempotence=true → no duplicates from producer retries, written to all in-sync replicas."],
 // ---- broker ----
 ["topic","Topic / partitions","payments.events (3 partitions)",240,45,200,"broker","A topic is split into partitions; each partition is an ordered, append-only log on a leader broker with replicas."],
 ["log","Partition log","offsets 0,1,2…",240,85,200,"broker","Each record gets the next offset. Records stay for the retention time, whether consumed or not."],
 ["isr","Replication","leader + in-sync replicas",240,125,200,"broker","acks=all waits for all in-sync replicas; min.insync.replicas (e.g. 2) is the minimum ISR size for writes to be accepted."],
 ["newtopic","Topic creation","NewTopic bean → KafkaAdmin",240,165,200,"broker","Boot's KafkaAdmin creates topics declared as NewTopic beans at startup, and increases partitions of existing ones if needed."],
 // ---- consumer ----
 ["cont","Listener container","ConcurrentMessageListenerContainer",460,45,210,"cons","Created for each @KafkaListener. concurrency = N → N consumers, each on its own thread (≤ partitions is useful)."],
 ["group","Consumer group","partition assignment / rebalance",460,85,210,"cons","Consumers with the same group.id share the partitions; each partition goes to exactly one consumer in the group. Joins/leaves trigger a rebalance."],
 ["poll","Poll loop","consumer.poll()",460,125,210,"cons","Fetches up to max.poll.records (500). If processing takes longer than max.poll.interval.ms (5 min) the consumer is removed from the group."],
 ["deser","Deserializer","ErrorHandlingDeserializer → JsonDeserializer",460,165,210,"cons","Bytes → objects. Wrapping in ErrorHandlingDeserializer turns a bad message into a handled error instead of an endless poll loop."],
 ["listener","@KafkaListener method","MessagingMessageListenerAdapter",460,205,210,"cons","Invokes your method with the converted payload (and headers/metadata if asked)."],
 ["offsets","Offset commit","AckMode.BATCH (default)",460,245,210,"cons","Spring commits offsets after all records from a poll are processed (auto-commit is off). Commit = 'processed up to here' for the group."],
 ["errh","Error handler","DefaultErrorHandler",460,285,210,"cons","On listener exception: seeks back and redelivers (default 10 attempts, no delay), then calls the recoverer."],
 ["dlt","Dead-letter topic","DeadLetterPublishingRecoverer",460,325,210,"cons","Recoverer that publishes the failed record (with exception headers) to <topic>-dlt (Spring Kafka 3.3+) so the partition can move on."],
 ["retrytopic","Non-blocking retries","@RetryableTopic",460,365,210,"cons","Failed records go to retry topics with delays (e.g. -retry-1000, -retry-2000, suffixed by delay) and finally a DLT, without blocking the main partition."],
 // ---- consistency ----
 ["dual","Dual write problem","DB commit + Kafka send",690,45,200,"cons2","Saving to the DB and sending to Kafka are two systems: one can succeed while the other fails."],
 ["afterc","Send after commit","@TransactionalEventListener(AFTER_COMMIT)",690,85,200,"cons2","Publishes only if the DB commit succeeded — but a crash between commit and send loses the event."],
 ["outbox","Transactional outbox","outbox table + relay",690,125,200,"cons2","Write the event into an outbox table in the SAME DB transaction; a relay (poller or Debezium CDC) publishes it to Kafka. At-least-once, no loss."],
 ["idem","Idempotent consumer","processed_events table / unique key",690,165,200,"cons2","Kafka delivers at least once, so the consumer must ignore duplicates (e.g. store event ids with a unique constraint)."],
 ["ktx","Kafka transactions","transaction-id-prefix",690,205,200,"cons2","Atomic writes across Kafka partitions/topics and consume-process-produce with exactly-once inside Kafka — does not include your database."],
 // ---- your code ----
 ["pub","PaymentEventPublisher","your producer code",20,460,190,"you","Builds PaymentCreated and calls kafkaTemplate.send(\"payments.events\", paymentId, event)."],
 ["event","PaymentCreated","your event record",220,460,190,"you","The message payload (id, amount, status, occurredAt, eventId)."],
 ["notif","NotificationListener","your @KafkaListener",420,460,190,"you","@KafkaListener(topics = \"payments.events\", groupId = \"notifications\") void on(PaymentCreated e)."],
 ["svc","PaymentService","@Transactional",620,460,190,"you","Creates the payment and triggers the event."]
];
var GROUPS = [
 ["Producer",10,22,220,260],["Broker",230,22,220,180],["Consumer (Spring Kafka)",450,22,230,380],["Consistency patterns",680,22,220,220],["Your code",10,440,1150,60]
];
var OWN = {
 kt:["config","Auto-configured; inject KafkaTemplate<String, PaymentCreated>."],
 ser:["config","spring.kafka.producer.key-serializer / value-serializer."],
 part:["write","You choose the key (e.g. paymentId or accountId) — that decides ordering."],
 acc:["config","spring.kafka.producer.batch-size, properties.linger.ms."],
 sender:["spring","Kafka client internal."],
 ack:["config","spring.kafka.producer.acks (keep all) and retries."],
 topic:["config","Partition count decided when the topic is created."],
 log:["ext","Kafka broker storage; retention via topic config."],
 isr:["ext","Broker/topic config (replication.factor, min.insync.replicas)."],
 newtopic:["write","@Bean NewTopic payments() { return TopicBuilder.name(\"payments.events\").partitions(3).replicas(3).build(); }"],
 cont:["config","spring.kafka.listener.concurrency, ack-mode; created from your @KafkaListener."],
 group:["config","groupId on @KafkaListener or spring.kafka.consumer.group-id."],
 poll:["config","spring.kafka.consumer.max-poll-records, properties.max.poll.interval.ms."],
 deser:["config","spring.kafka.consumer.value-deserializer=ErrorHandlingDeserializer + spring.kafka.consumer.properties.spring.deserializer.value.delegate.class=…JsonDeserializer + trusted packages."],
 listener:["write","Your @KafkaListener method."],
 offsets:["config","spring.kafka.listener.ack-mode (BATCH default; RECORD, MANUAL…)."],
 errh:["config","A DefaultErrorHandler bean with a BackOff and recoverer (Boot picks up a CommonErrorHandler bean)."],
 dlt:["config","new DeadLetterPublishingRecoverer(kafkaTemplate) passed to the DefaultErrorHandler."],
 retrytopic:["write","@RetryableTopic(attempts = \"4\", backoff = @Backoff(delay = 1000, multiplier = 2)) on the listener."],
 dual:["spring","A design problem, not a class."],
 afterc:["write","Your @TransactionalEventListener that sends to Kafka."],
 outbox:["write","Outbox entity + relay job (or Debezium)."],
 idem:["write","Your dedup check in the listener's transaction."],
 ktx:["config","spring.kafka.producer.transaction-id-prefix; consumers with isolation.level=read_committed."],
 pub:["write","Your publisher."],
 event:["write","Your event record."],
 notif:["write","Your listener class."],
 svc:["write","Your service."]
};
var SECTIONS = ["MESSAGE","PRODUCER","BROKER","CONSUMER","OFFSETS","DATABASE","RESULT"];
