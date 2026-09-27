var SCENARIOS = [
// =====================================================================
{id:"produce", group:"Producer", name:"Publish PaymentCreated: send() → partition → broker ack",
 goal:"What happens between kafkaTemplate.send(...) and the record sitting in the log.",
 steps:[
 {n:"pub",t:"Your code sends",w:"kafkaTemplate.send(\"payments.events\", paymentId, new PaymentCreated(…))",d:["Key = paymentId (or accountId if you need per-account ordering)."],c:{"MESSAGE|topic":"payments.events","MESSAGE|key":"42","MESSAGE|value":"PaymentCreated(id=42, amount=100.00, eventId=e-7f3c)"},f:"—",iv:"—"},
 {n:"kt",t:"Returns a future immediately",w:"KafkaTemplate.send → doSend → KafkaProducer.send (async)",d:["Returns CompletableFuture<SendResult>; nothing is guaranteed yet."],c:{"PRODUCER|future":"pending"},f:"Ignoring the future → failures only in logs; the caller thinks it was sent.",iv:"KafkaTemplate.send is asynchronous; check the CompletableFuture (whenComplete) or call get() with a timeout if you must know."},
 {n:"ser",t:"Serialize",w:"StringSerializer (key), JsonSerializer (value)",d:["JsonSerializer adds a __TypeId__ header by default."],c:{"MESSAGE|bytes":"key 2 bytes, value 96 bytes + headers"},f:"Serializer error → exception from send() (synchronous part).",iv:"—"},
 {n:"part",t:"Choose the partition",w:"BuiltInPartitioner: murmur2(key) % 3",d:["Every event for payment 42 goes to the same partition → order kept per payment."],c:{"PRODUCER|partition":"payments.events-1"},f:"—",iv:"Ordering is guaranteed only within a partition; the key decides the partition."},
 {n:"acc",t:"Batch",w:"RecordAccumulator.append",d:["Waits up to linger.ms (0 in Kafka 3.x clients, 5 ms from Kafka 4.0) or until batch.size (16 KB)."],c:{"PRODUCER|batch":"partition 1: 1 record"},f:"Buffer full (buffer.memory) → send() blocks up to max.block.ms.",iv:"—"},
 {n:"sender",t:"Ship to the leader",w:"Sender thread → ProduceRequest to the leader of partition 1",d:["Retries transient errors automatically (with idempotence, no duplicates)."],c:{},f:"—",iv:"—"},
 {n:"log",t:"Appended to the log",w:"leader writes offset 1834",d:[],c:{"BROKER|partition 1":"… 1833, 1834 (PaymentCreated 42)"},f:"—",iv:"—"},
 {n:"isr",t:"Replicated",w:"followers fetch; acks=all waits for ALL replicas currently in the ISR",d:["min.insync.replicas=2 is only a floor: if fewer than 2 replicas are in sync, the write is rejected."],c:{"BROKER|replicas":"leader + 2 followers (all in ISR) have it"},f:"Too few in-sync replicas → NotEnoughReplicasException; the producer retries.",iv:"—"},
 {n:"ack",t:"Ack → future completes",w:"SendResult(RecordMetadata topic=payments.events, partition=1, offset=1834)",d:["Only now is the event durable."],c:{"PRODUCER|future":"done: partition 1, offset 1834"},f:"—",iv:"acks=all + idempotent producer (default in Kafka 3.x clients) = durable, no producer-side duplicates."}
 ]},
// =====================================================================
{id:"dual", extra:["svc"], group:"Producer", name:"Dual write: DB commit + Kafka send (and the outbox fix)",
 goal:"Saving the payment and publishing its event are two systems — how each approach can fail.",
 steps:[
 {n:"dual",t:"Naive: send inside @Transactional",w:"paymentRepository.save(p); kafkaTemplate.send(…); // same method",
  d:["Kafka send happens before the DB commit.","If the commit then fails (constraint, timeout) → rollback, but the event is already out: consumers notify about a payment that doesn't exist."],c:{"DATABASE|payment 42":"rolled back","MESSAGE|PaymentCreated 42":"published (ghost event)"},f:"This is the failure path.",iv:"—"},
 {n:"afterc",t:"Better: publish after commit",w:"publishEvent(PaymentCreated) → @TransactionalEventListener(AFTER_COMMIT) → kafkaTemplate.send",
  d:["No ghost events.","But a crash or Kafka outage right after the commit loses the event forever."],c:{"DATABASE|payment 42":"committed","MESSAGE|PaymentCreated 42":"lost if the app dies here"},f:"—",iv:"—",z:[["core","events",3,"How @TransactionalEventListener works"]]},
 {n:"outbox",t:"Reliable: transactional outbox",w:"same @Transactional: save(payment) + save(new OutboxEvent(\"PaymentCreated\", json))",
  d:["Both rows commit or roll back together — one database, one transaction."],c:{"DATABASE|payment 42":"committed","DATABASE|outbox":"PaymentCreated 42 (NEW)"},f:"—",iv:"—"},
 {n:"outbox",t:"Relay publishes",w:"@Scheduled poller (or Debezium CDC reading the DB log) → kafkaTemplate.send → mark SENT",
  d:["If the relay crashes after sending but before marking SENT, it sends again → duplicates are possible."],c:{"MESSAGE|PaymentCreated 42":"published (at least once)","DATABASE|outbox":"PaymentCreated 42 (SENT)"},f:"—",iv:"The outbox pattern turns the dual write into one DB transaction plus an at-least-once relay."},
 {n:"idem",t:"So consumers must be idempotent",w:"listener: insert eventId into processed_events (unique) in the same DB transaction as its work",d:["Duplicate → unique violation → skip."],c:{},f:"—",iv:"At-least-once delivery + idempotent consumers is the practical 'exactly once'."},
 {n:"ktx",t:"Why Kafka transactions don't solve this",w:"transaction-id-prefix → KafkaTransactionManager",d:["Kafka transactions make writes to several Kafka partitions atomic (and consume-process-produce exactly-once within Kafka).","They cannot include your relational database commit."],c:{},f:"—",iv:"—"}
 ]},
// =====================================================================
{id:"consume", group:"Consumer", name:"Consume: container → poll → listener → offset commit",
 goal:"How a @KafkaListener method gets called and when the offset is committed.",
 steps:[
 {n:"notif",t:"Your listener",w:"@KafkaListener(id = \"notifications\", topics = \"payments.events\", groupId = \"notifications\", concurrency = \"3\") void on(PaymentCreated e)",d:[],c:{"CONSUMER|group":"notifications"},f:"—",iv:"—"},
 {n:"cont",t:"Container per listener",w:"KafkaListenerAnnotationBeanPostProcessor → KafkaListenerEndpointRegistry → ConcurrentMessageListenerContainer",
  d:["concurrency 3 → 3 KafkaMessageListenerContainers, each a consumer on its own thread.","Thread names come from the listener id (without an id: org.springframework.kafka.KafkaListenerEndpointContainer#0-0-C-1)."],c:{"CONSUMER|threads":"notifications-0-C-1, notifications-1-C-1, notifications-2-C-1"},f:"—",iv:"—"},
 {n:"group",t:"Join the group, get partitions",w:"consumer group coordinator → assignment",d:["3 partitions / 3 consumers → one partition each.","A 4th consumer would sit idle."],c:{"CONSUMER|assignment":"C1: p0, C2: p1, C3: p2"},f:"—",iv:"Parallelism is capped by the partition count: more consumers than partitions sit idle."},
 {n:"offsets",t:"Where does a NEW group start?",w:"auto.offset.reset (default latest)",d:["No committed offset for this group → 'latest' skips everything already in the topic; 'earliest' reads from the start."],c:{"OFFSETS|notifications/p1":"(none yet → latest)"},f:"New consumer group 'misses' old events because of latest.",iv:"auto.offset.reset only applies when the group has no valid committed offset."},
 {n:"poll",t:"Poll",w:"KafkaMessageListenerContainer.ListenerConsumer.run → consumer.poll",d:["Up to 500 records per poll, starting from the group's committed offset."],c:{"CONSUMER|C2 fetched":"offsets 1834–1840 (7 records)"},f:"—",iv:"—"},
 {n:"deser",t:"Deserialize",w:"ErrorHandlingDeserializer → JsonDeserializer (trusted packages)",d:[],c:{"MESSAGE|value":"PaymentCreated(id=42 …)"},f:"Untrusted/unknown type or bad JSON → DeserializationException (see error scenario).",iv:"—"},
 {n:"listener",t:"Your method runs",w:"MessagingMessageListenerAdapter.onMessage → NotificationListener.on(event)",d:["Records of one partition are processed one after another on the same thread."],c:{"RESULT|email":"sent for payment 42"},f:"—",iv:"—"},
 {n:"offsets",t:"Commit after the batch",w:"AckMode.BATCH → commitSync/commitAsync offset 1841",
  d:["Committed offset = next record to read.","Crash before the commit → these 7 records are delivered again after restart (at-least-once)."],c:{"OFFSETS|notifications/p1":"1841"},f:"—",iv:"Offsets are committed after processing (at-least-once); a crash in between means redelivery, so handle duplicates."}
 ]},
// =====================================================================
{id:"errors", group:"Consumer", name:"Listener fails: retries → dead-letter topic",
 goal:"A poison message must not block the partition forever.",
 steps:[
 {n:"listener",t:"Listener throws",w:"NotificationListener.on → EmailClientException",d:[],c:{"CONSUMER|record":"p1 offset 1836"},f:"—",iv:"—"},
 {n:"errh",t:"DefaultErrorHandler: blocking retries",w:"DefaultErrorHandler.handleRemaining → seek back to 1836 → redeliver",
  d:["Default BackOff: FixedBackOff(0, 9) → 10 attempts in total, no delay.","While retrying, later records on partition 1 wait (ordering kept)."],c:{"CONSUMER|attempt":"10/10"},f:"—",iv:"—"},
 {n:"dlt",t:"Recover to the DLT",w:"DeadLetterPublishingRecoverer → payments.events-dlt (Spring Kafka 3.3+; '.DLT' before 3.3), same partition number by default",d:["Headers carry the exception class, message, stack trace and original topic/offset.","The DLT needs at least as many partitions as the original topic."],c:{"MESSAGE|DLT":"payments.events-dlt p1 (original offset 1836)"},f:"Without a recoverer the default just logs the failure and skips the record.",iv:"—"},
 {n:"offsets",t:"Move on",w:"committed offset 1837 (1836 recovered); 1837+ processed",d:[],c:{"OFFSETS|notifications/p1":"1837"},f:"—",iv:"Blocking retries (DefaultErrorHandler) then a dead-letter topic; inspect and replay DLT records later."},
 {n:"deser",t:"Bad bytes skip retries",w:"ErrorHandlingDeserializer → DeserializationException (in the non-retryable list)",d:["Straight to the recoverer/DLT — retrying can't fix bad bytes."],c:{},f:"Without ErrorHandlingDeserializer the container can't get past the record: endless errors in the log.",iv:"—"},
 {n:"retrytopic",t:"Non-blocking alternative",w:"@RetryableTopic(attempts = \"4\", backoff = @Backoff(delay = 1000, multiplier = 2))",
  d:["Failed record → payments.events-retry-1000 (after 1 s) → -retry-2000 → -retry-4000 → payments.events-dlt (topic names suffixed with the delay by default).","Main partition keeps flowing; ordering for that key is NOT kept."],c:{},f:"—",iv:"Retry topics avoid blocking the partition at the cost of ordering."}
 ]},
// =====================================================================
{id:"dupes", group:"Consumer", name:"Duplicates and slow consumers (rebalance)",
 goal:"Two classic ways the same record is processed twice.",
 steps:[
 {n:"listener",t:"Processing takes too long",w:"500 records × 1 s each = 8+ minutes per poll",d:["max.poll.interval.ms = 5 min."],c:{"CONSUMER|C2":"still processing batch"},f:"—",iv:"—"},
 {n:"poll",t:"Kicked out of the group",w:"no poll() within max.poll.interval.ms → consumer leaves the group",d:[],c:{"CONSUMER|C2":"removed from group"},f:"—",iv:"—"},
 {n:"group",t:"Rebalance",w:"partition 1 reassigned to C3",d:["C2's offsets for this batch were never committed."],c:{"CONSUMER|assignment":"C1: p0, C3: p1+p2"},f:"—",iv:"—"},
 {n:"offsets",t:"C3 starts from the last commit",w:"committed offset 1834",d:["Records C2 already processed are processed again."],c:{"RESULT|emails":"sent twice for some payments"},f:"—",iv:"Slow processing → rebalance → duplicates; lower max.poll.records or speed up processing."},
 {n:"group",t:"Rebalance details",w:"assignors [RangeAssignor, CooperativeStickyAssignor]; session.timeout.ms 45 s vs max.poll.interval.ms 5 min",
  d:["session timeout = no heartbeats (process dead); max.poll.interval = alive but too slow.","Cooperative rebalancing moves only affected partitions; static membership (group.instance.id) avoids rebalances on quick restarts.","ConsumerRebalanceListener hooks partitions revoked/assigned."],c:{},f:"—",iv:"—"},
 {n:"idem",t:"Idempotent consumer",w:"insert into processed_events(event_id) … (unique) in the listener's DB transaction; duplicate → skip",d:["Use the eventId from the message, not the offset."],c:{"RESULT|emails":"once per payment"},f:"—",iv:"Design every consumer to be idempotent — Kafka's normal guarantee is at-least-once."}
 ]},
// =====================================================================
{id:"setup", group:"Producer", name:"Topics, partitions and keys: design choices",
 goal:"Decisions you make once that decide ordering and scale.",
 steps:[
 {n:"newtopic",t:"Declare the topic",w:"@Bean NewTopic → KafkaAdmin creates payments.events (3 partitions, replication 3) at startup",d:["If the topic exists with fewer partitions, KafkaAdmin increases them (never decreases). Config changes only with modifyTopicConfigs=true."],c:{"BROKER|payments.events":"3 partitions × 3 replicas"},f:"—",iv:"—"},
 {n:"topic",t:"Partitions = max parallelism",w:"3 partitions → at most 3 active consumers per group",d:["Adding partitions later changes key → partition mapping (ordering breaks for existing keys)."],c:{},f:"—",iv:"—"},
 {n:"part",t:"Pick the key for ordering",w:"key = accountId if all events of an account must be in order",d:["Hot keys → one partition overloaded."],c:{},f:"—",iv:"—"},
 {n:"log",t:"Retention vs compaction",w:"cleanup.policy=delete (time/size) vs compact",d:["compact keeps the latest value per key; a null value (tombstone) deletes the key — good for 'current state' topics."],c:{},f:"—",iv:"—"},
 {n:"ack",t:"Ordering with retries",w:"enable.idempotence=true requires max.in.flight.requests.per.connection ≤ 5",d:["Idempotence keeps order per partition even when batches are retried.","Watch consumer lag (records behind) to see if consumers keep up."],c:{},f:"—",iv:"—"},
 {n:"event",t:"Event design",w:"PaymentCreated(eventId, paymentId, amount, currency, occurredAt, version)",d:["Include an eventId for idempotency and a schema version for evolution (Avro/Schema Registry for strict contracts)."],c:{},f:"—",iv:"Events are facts in the past tense with an id; consumers must tolerate new optional fields."}
 ]},
// =====================================================================
{id:"manual", group:"Consumer", name:"Manual acks, batch listeners, testing",
 goal:"More control over when offsets are committed, and how to test listeners.",
 steps:[
 {n:"offsets",t:"Manual acknowledgment",w:"spring.kafka.listener.ack-mode=manual_immediate + on(PaymentCreated e, Acknowledgment ack) { …; ack.acknowledge(); }",d:["Commit only after your own condition (e.g. DB write done).","ack.nack(Duration) re-seeks and redelivers after a pause."],c:{"OFFSETS|mode":"MANUAL_IMMEDIATE"},f:"Forgetting acknowledge() → the offset never moves; restarts reprocess.",iv:"—"},
 {n:"listener",t:"Batch listener",w:"@KafkaListener(batch = \"true\") void on(List<PaymentCreated> events)",d:["Process a whole poll at once (bulk insert).","Throw BatchListenerFailedException(index) so the error handler knows which record failed."],c:{},f:"—",iv:"—"},
 {n:"cont",t:"Testing listeners",w:"@EmbeddedKafka or Testcontainers KafkaContainer (@ServiceConnection)",d:["Publish a record, then await (Awaitility) the side effect; test the DLT path too."],c:{},f:"—",iv:"—"}
 ]}
];