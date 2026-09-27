var SCENARIOS = [
// =====================================================================
{id:"startup", extra:["repo"], group:"Repositories", name:"Startup: interface → proxy, queries checked",
 goal:"How an interface with no implementation becomes a working bean, and why a typo in a method name fails startup.",
 steps:[
 {n:"iface",t:"Your interface",w:"interface PaymentRepository extends JpaRepository<Payment, Long> { List<Payment> findByStatus(PaymentStatus s); }",d:[],c:{"CALL|interface":"PaymentRepository"},f:"—",iv:"—"},
 {n:"factory",t:"Found by repository scanning",w:"JpaRepositoriesAutoConfiguration → @EnableJpaRepositories → RepositoryConfigurationDelegate registers JpaRepositoryFactoryBean",
  d:["Scans the main class's package for interfaces extending Repository."],c:{"RESULT|bean definition":"paymentRepository → JpaRepositoryFactoryBean"},f:"Repository outside the scanned packages → NoSuchBeanDefinitionException.",iv:"—"},
 {n:"factory",t:"Build the proxy",w:"JpaRepositoryFactoryBean.afterPropertiesSet → RepositoryFactorySupport.getRepository → ProxyFactory",
  d:["Target = SimpleJpaRepository for the Payment entity.","Adds interceptors: exception translation, transactions, query methods."],c:{"RESULT|bean":"jdk.proxy $ProxyNN implements PaymentRepository"},f:"—",iv:"A Spring Data repository is a JDK proxy around SimpleJpaRepository plus query-method interceptors."},
 {n:"lookup",t:"Resolve every query method now",w:"QueryExecutorMethodInterceptor → JpaQueryLookupStrategy.resolveQuery (CREATE_IF_NOT_FOUND)",
  d:["No @Query on findByStatus → derive it."],c:{},f:"—",iv:"—"},
 {n:"derived",t:"Parse the method name",w:"PartTreeJpaQuery → PartTree(\"findByStatus\", Payment.class)",
  d:["Subject 'find', predicate 'Status' → checks that Payment has a property 'status'."],c:{"RESULT|findByStatus":"criteria query ≈ select p from Payment p where p.status = ?1"},
  f:"findByStatuss → startup fails: QueryCreationException: Could not create query for … findByStatuss; Reason: … No property 'statuss' found for type 'Payment' (Did you mean 'status'?).",iv:"Derived queries are validated at startup, so a typo in a method name stops the app from starting."},
 {n:"declared",t:"@Query methods are validated too",w:"SimpleJpaQuery → validateQuery (creates the JPQL query once)",d:["Invalid JPQL (wrong entity/field name) → startup failure. Native queries aren't validated."],c:{},f:"—",iv:"—"}
 ]},
// =====================================================================
{id:"persist", group:"Writes", name:"save() a new entity → persist → INSERT",
 goal:"What save() really does for a new object, and when the INSERT is actually sent.",
 steps:[
 {n:"svc",t:"Service in a transaction",w:"@Transactional PaymentService.create → repository.save(new Payment(…))",d:["Transaction and persistence context already open on this thread."],c:{"TRANSACTION|status":"active","PERSISTENCE CONTEXT|managed":"(empty)","ENTITY|payment":"TRANSIENT (id=null)"},f:"—",iv:"—"},
 {n:"hikari",t:"The transaction already holds a connection",w:"JpaTransactionManager.doBegin → Hibernate → HikariCP",d:["Every statement below uses this one connection (autoCommit=false)."],c:{"TRANSACTION|connection":"HikariProxyConnection@7"},f:"—",iv:"—"},
 {n:"rproxy",t:"Repository proxy",w:"proxy → PersistenceExceptionTranslationInterceptor → TransactionInterceptor (REQUIRED: joins) → SimpleJpaRepository.save",d:[],c:{"CALL|method":"save(payment)"},f:"—",iv:"—"},
 {n:"simple",t:"isNew?",w:"SimpleJpaRepository.save → JpaEntityInformation.isNew(entity)",
  d:["With a @Version wrapper field: new if version == null. Otherwise: new if the id is null (or 0 for primitives).","New → em.persist(entity) and return the SAME object."],c:{"CALL|path":"persist (isNew = true)"},f:"Assigned ids (you set the id yourself) without @Version → isNew false → merge → an extra SELECT.",iv:"save() = persist for new entities, merge for existing ones; isNew is decided by @Version or the id."},
 {n:"sharedem",t:"Shared EntityManager → the transaction's one",w:"SharedEntityManagerCreator proxy → EntityManagerFactoryUtils.doGetTransactionalEntityManager",d:["Finds the EntityManager bound to this thread by JpaTransactionManager."],c:{},f:"—",iv:"—"},
 {n:"states",t:"TRANSIENT → MANAGED",w:"Hibernate SessionImpl.persist",d:["The object is now in the persistence context and tracked."],c:{"ENTITY|payment":"MANAGED","PERSISTENCE CONTEXT|managed":"Payment#?"},f:"—",iv:"—"},
 {n:"actionq",t:"When does INSERT run?",w:"GenerationType.IDENTITY vs SEQUENCE",
  d:["IDENTITY: the DB generates the id → INSERT must run immediately to get it (and JDBC insert batching is disabled).","SEQUENCE: Hibernate gets the id from the sequence (pooled) → INSERT is queued until flush."],c:{"SQL|sent":"insert into payment … (IDENTITY: now)","ENTITY|payment":"MANAGED (id=43)","PERSISTENCE CONTEXT|managed":"Payment#43"},f:"—",iv:"IDENTITY forces an immediate INSERT and disables batch inserts; SEQUENCE lets Hibernate batch at flush."},
 {n:"flush",t:"Commit → flush → COMMIT",w:"JpaTransactionManager.commit → Hibernate flush → Connection.commit",d:["ActionQueue order: orphan removals, inserts, updates, collection changes, deletes."],c:{"TRANSACTION|status":"committed"},f:"Constraint violations for queued SQL appear here, after your method returned.",iv:"—"}
 ]},
// =====================================================================
{id:"dirty", group:"Writes", name:"Dirty checking: change a field, no save() needed",
 goal:"Why setters on a managed entity are enough, and why the same code does nothing outside a transaction or with readOnly.",
 steps:[
 {n:"svc",t:"Load and change",w:"@Transactional refund(42): Payment p = repo.findById(42).orElseThrow(); p.setStatus(REFUNDED);",d:["No repo.save(p) call."],c:{"TRANSACTION|status":"active"},f:"—",iv:"—"},
 {n:"pc",t:"findById puts it in the context",w:"SimpleJpaRepository.findById → em.find(Payment.class, 42)",
  d:["SELECT … where id=42.","Hibernate keeps a snapshot of the loaded values.","Calling findById(42) again in this transaction returns the same object without SQL."],c:{"SQL|sent":"select … from payment where id=42","PERSISTENCE CONTEXT|managed":"Payment#42 (snapshot: status=COMPLETED)","ENTITY|payment":"MANAGED"},f:"—",iv:"The persistence context is a first-level cache: one object per id per transaction."},
 {n:"entity",t:"Setter changes the object",w:"payment.setStatus(REFUNDED)",d:["Plain Java; nothing is sent yet."],c:{"ENTITY|status":"REFUNDED (dirty)"},f:"—",iv:"—"},
 {n:"flush",t:"Flush compares with the snapshot",w:"commit → DefaultFlushEventListener → dirty checking",d:["status differs → UPDATE queued and executed."],c:{"SQL|sent":"update payment set amount=?, status='REFUNDED', …, version=2 where id=42 and version=1 (all columns; @DynamicUpdate for changed-only)","TRANSACTION|status":"committed"},f:"—",iv:"Managed entities are saved automatically at flush; save() on an already-managed entity is redundant."},
 {n:"states",t:"Same code without a transaction",w:"no @Transactional on refund()",
  d:["With spring.jpa.open-in-view=false: findById runs in the repository's own short read-only transaction → returns a DETACHED object; setStatus changes nothing in the DB — silently.","With OSIV on (Boot default) the entity stays managed for the request, and a LATER @Transactional call in the same request would flush this change — even more confusing."],c:{"ENTITY|payment":"DETACHED (no transaction, OSIV off)"},f:"Classic bug: 'my update is not saved' because the service method isn't @Transactional.",iv:"—"},
 {n:"flush",t:"readOnly = true",w:"@Transactional(readOnly = true) → HibernateJpaDialect: FlushMode.MANUAL + session.setDefaultReadOnly(true)",d:["No flush at commit → the change is ignored.","Entities are loaded read-only: no snapshots kept → less memory, no dirty checking."],c:{},f:"—",iv:"—",z:[["core","lazy-osiv",1,"What readOnly does to Hibernate"]]}
 ]},
// =====================================================================
{id:"merge", group:"Writes", name:"save() with an existing id → merge (returns a different object)",
 goal:"Updating from a detached object/DTO: extra SELECT, and why you must use the returned instance.",
 steps:[
 {n:"svc",t:"Detached object from outside",w:"Payment p = new Payment(); p.setId(42); p.setVersion(1L); p.setAmount(…); repo.save(p);",d:["Object not loaded in this transaction.","Because Payment has @Version, isNew() looks at version: it must be set (non-null) or save() would call persist → 'detached entity passed to persist'."],c:{"ENTITY|p":"DETACHED (id=42)"},f:"—",iv:"—"},
 {n:"simple",t:"Not new → merge",w:"SimpleJpaRepository.save → em.merge(p)",d:[],c:{"CALL|path":"merge (isNew = false)"},f:"—",iv:"—"},
 {n:"merge",t:"Load the managed copy and copy fields",w:"Hibernate DefaultMergeEventListener",
  d:["SELECT payment 42 (unless already in the context).","Copies ALL fields from p onto the managed instance — including nulls you didn't set.","Returns the managed instance, not p."],
  c:{"SQL|sent":"select … where id=42","ENTITY|managed copy":"MANAGED Payment#42 (fields from p)","ENTITY|p":"still DETACHED"},f:"Fields you didn't set are overwritten with null.",
  iv:"merge copies the whole detached state onto a managed copy and returns that copy; for partial updates, load the entity and set only the changed fields."},
 {n:"flush",t:"UPDATE at commit",w:"flush → update payment set … where id=42",d:["Changes made to p after save() are NOT tracked — use the returned object."],c:{"SQL|sent":"update payment set amount=…, status=null … where id=42"},f:"—",iv:"—"}
 ]},
// =====================================================================
{id:"derivedq", group:"Reads", name:"Derived query run: findByStatus → FlushMode.AUTO → SQL",
 goal:"What happens when a query method runs inside a transaction that has pending changes.",
 steps:[
 {n:"svc",t:"Pending change, then a query",w:"p.setStatus(COMPLETED); … repo.findByStatus(COMPLETED)",d:["The change is not flushed yet."],c:{"PERSISTENCE CONTEXT|pending":"Payment#42 status → COMPLETED (not flushed)"},f:"—",iv:"—"},
 {n:"rproxy",t:"Query method interceptor",w:"QueryExecutorMethodInterceptor.invoke → PartTreeJpaQuery.execute",d:["Uses the query prepared at startup, binds the parameter."],c:{"CALL|method":"findByStatus(COMPLETED)"},f:"—",iv:"—"},
 {n:"flush",t:"Auto flush first",w:"FlushMode.AUTO: the query touches the payment table, which has pending changes → flush",d:["So the query sees your own un-committed change."],c:{"SQL|sent":"update payment set status='COMPLETED' where id=42","PERSISTENCE CONTEXT|pending":null},f:"—",iv:"Hibernate flushes before a query that could see pending changes (FlushMode.AUTO), so queries are consistent with the transaction."},
 {n:"jdbc",t:"Run the SELECT",w:"PreparedStatement: select … from payment p where p.status=?",d:[],c:{"SQL|sent":"select … where status='COMPLETED'"},f:"—",iv:"—"},
 {n:"pc",t:"Results become managed",w:"Rows → entities; ids already in the context return the existing objects",d:[],c:{"RESULT|rows":"3 payments (managed)"},f:"—",iv:"—"}
 ]},
// =====================================================================
{id:"nplus1", group:"Reads", name:"N+1 queries and the three fixes",
 goal:"The most common JPA performance bug, how to spot it, and how to fix it.",
 steps:[
 {n:"svc",t:"List payments, then touch items",w:"for (Payment p : repo.findAll()) total += p.getItems().size();",d:["items is @OneToMany(fetch = LAZY)."],c:{},f:"—",iv:"—"},
 {n:"jdbc",t:"1 query for the list",w:"select … from payment",d:[],c:{"SQL|count":"1","RESULT|rows":"100 payments"},f:"—",iv:"—"},
 {n:"lazy",t:"Each getItems() loads separately",w:"PersistentBag.initialize → select … from payment_item where payment_id=?",d:["100 payments → 100 more queries."],c:{"SQL|count":"101"},f:"Fine with 3 rows in dev, slow with 10,000 in prod.",iv:"—"},
 {n:"nplus1",t:"That's N+1",w:"spring.jpa.show-sql=true / Hibernate statistics",d:["Spot it by counting queries in logs or tests."],c:{},f:"—",iv:"N+1 = one query for N parents + one per parent for a lazy association."},
 {n:"fetchjoin",t:"Fix 1: fetch join / entity graph",w:"@Query(\"select distinct p from Payment p join fetch p.items\") or @EntityGraph(attributePaths = \"items\")",d:["One query with a join."],c:{"SQL|count":"1"},f:"Fetch-joining a collection AND paging → Hibernate warns HHH90003004 and pages in memory.",iv:"—"},
 {n:"batchfetch",t:"Fix 2: batch fetching",w:"hibernate.default_batch_fetch_size=50",d:["Lazy loads for many parents are grouped: … where payment_id in (?,?,…) (on PostgreSQL Hibernate 6.2+ uses = any(?) with one array parameter)."],c:{"SQL|count":"1 + 2"},f:"—",iv:"—"},
 {n:"projection",t:"Fix 3: project only what you need",w:"record PaymentTotal(Long id, long items) + @Query(\"select new …PaymentTotal(p.id, size(p.items)) from Payment p\")",d:["No entities, no lazy associations, no dirty checking."],c:{"SQL|count":"1"},f:"—",iv:"Fix N+1 with fetch join/@EntityGraph, batch fetching, or DTO projections."},
 {n:"eagerdef",t:"Why EAGER isn't the fix",w:"@ManyToOne is EAGER by default",d:["EAGER still loads with extra queries in many cases (N+1 on the other side) and loads data you don't need everywhere.","Make associations LAZY and choose fetching per query."],c:{},f:"—",iv:"—"}
 ]},
// =====================================================================
{id:"lazyex", group:"Reads", name:"LazyInitializationException",
 goal:"Touching a lazy association after the persistence context closed.",
 prev:["core","lazy-osiv",2,"Same story from the transaction side"],
 steps:[
 {n:"svc",t:"Service returns the entity",w:"@Transactional(readOnly = true) Payment get(id) → return repo.findById(id)",d:[],c:{"ENTITY|payment":"MANAGED, items not loaded"},f:"—",iv:"—"},
 {n:"states",t:"Transaction ends → detached",w:"JpaTransactionManager cleanup → EntityManager.close",d:["With spring.jpa.open-in-view=false."],c:{"ENTITY|payment":"DETACHED, items = uninitialised proxy","PERSISTENCE CONTEXT|session":"closed"},f:"—",iv:"—"},
 {n:"lazy",t:"Controller / Jackson touches items",w:"payment.getItems().size() → PersistentBag.initialize → no session",d:[],c:{"RESULT|error":"LazyInitializationException: failed to lazily initialize a collection … could not initialize proxy - no Session"},f:"This is the failure path.",iv:"—"},
 {n:"fetchjoin",t:"Fix",w:"Fetch inside the transaction (join fetch / @EntityGraph) and return a DTO",d:["Don't return entities from controllers."],c:{"RESULT|error":null},f:"—",iv:"LazyInitializationException = lazy data needed after the session closed; load it in the query and map to a DTO."}
 ]},
// =====================================================================
{id:"optimistic", group:"Concurrency", name:"Optimistic locking: two refunds at once (@Version)",
 goal:"Lost updates prevented without database locks.",
 steps:[
 {n:"entity",t:"Entity has @Version",w:"@Version Long version",d:[],c:{"ENTITY|Payment#42":"status=COMPLETED, version=1"},f:"—",iv:"—"},
 {n:"pc",t:"T1 and T2 both load version 1",w:"two requests → two transactions → findById(42)",d:[],c:{"TRANSACTION|T1":"sees version 1","TRANSACTION|T2":"sees version 1"},f:"—",iv:"—"},
 {n:"flush",t:"T1 commits first",w:"update payment set status='REFUNDED', version=2 where id=42 and version=1 → 1 row",d:[],c:{"SQL|T1":"1 row updated → version 2","TRANSACTION|T1":"committed"},f:"—",iv:"—"},
 {n:"version",t:"T2's update matches 0 rows",w:"update … where id=42 and version=1 → 0 rows → Hibernate StaleObjectStateException / OptimisticLockException",d:[],c:{"SQL|T2":"0 rows updated"},f:"This is the failure path.",iv:"—"},
 {n:"xlate",t:"Translated for Spring",w:"HibernateJpaDialect / PersistenceExceptionTranslator → ObjectOptimisticLockingFailureException (an OptimisticLockingFailureException)",
  d:["Thrown at flush/commit, so from the service proxy — after your method body."],c:{"TRANSACTION|T2":"rolled back","RESULT|error":"ObjectOptimisticLockingFailureException"},f:"—",
  iv:"@Version turns a lost update into an OptimisticLockingFailureException; map it to 409 Conflict or retry."}
 ]},
// =====================================================================
{id:"pessimistic", group:"Concurrency", name:"Pessimistic locking: SELECT … FOR UPDATE",
 goal:"When you must block others (e.g. balance updates), and the cost.",
 steps:[
 {n:"pessimistic",t:"Locking query",w:"@Lock(LockModeType.PESSIMISTIC_WRITE) Optional<Account> findWithLockById(Long id)",d:["Must run inside a transaction."],c:{},f:"No transaction → InvalidDataAccessApiUsageException (cause: TransactionRequiredException 'Query requires transaction be in progress').",iv:"—"},
 {n:"db",t:"Row lock taken",w:"select … from account where id=7 for update",d:["T1 holds the lock until commit/rollback."],c:{"SQL|T1":"select … for update","TRANSACTION|T1":"holds row lock on account 7"},f:"—",iv:"—"},
 {n:"db",t:"T2 waits",w:"T2 runs the same query → blocks",d:["Lock timeout via hint jakarta.persistence.lock.timeout (support depends on the DB)."],c:{"TRANSACTION|T2":"waiting"},f:"Timeout/deadlock → PessimisticLockingFailureException / CannotAcquireLockException.",iv:"—"},
 {n:"flush",t:"T1 commits → T2 continues with fresh data",w:"commit releases the lock",d:[],c:{"TRANSACTION|T1":"committed","TRANSACTION|T2":"reads updated balance"},f:"—",iv:"Optimistic = detect conflicts at commit (cheap, retry); pessimistic = block others with row locks (safe for hot rows, costs throughput)."}
 ]},
// =====================================================================
{id:"constraint", group:"Writes", name:"Unique constraint → DataIntegrityViolationException",
 goal:"Where the database error surfaces and why try/catch around save() often doesn't catch it.",
 steps:[
 {n:"svc",t:"Duplicate reference",w:"repo.save(new Payment(reference = \"INV-1\")) — INV-1 already exists",d:[],c:{"ENTITY|payment":"MANAGED (queued INSERT with SEQUENCE ids)"},f:"—",iv:"—"},
 {n:"flush",t:"INSERT runs at flush/commit",w:"commit → flush → insert … → SQLIntegrityConstraintViolation / unique violation",d:["With IDENTITY it happens inside save() instead."],c:{"SQL|sent":"insert … reference='INV-1' → unique constraint error"},f:"—",iv:"—"},
 {n:"xlate",t:"Translated",w:"At commit: JpaTransactionManager.doCommit → HibernateJpaDialect.translateExceptionIfPossible → DataIntegrityViolationException (inside save()/saveAndFlush: the repository's PersistenceExceptionTranslationInterceptor)",d:["Thrown from the @Transactional proxy after your method returned — a try/catch inside the method never sees it."],c:{"RESULT|error":"DataIntegrityViolationException","TRANSACTION|status":"rolled back"},f:"—",
  iv:"Database constraint errors often appear at commit. Catch DataIntegrityViolationException OUTSIDE the transaction (caller or @RestControllerAdvice → 409); catching it inside the same @Transactional method leaves a rollback-only transaction → UnexpectedRollbackException."}
 ]},
// =====================================================================
{id:"bulk", group:"Writes", name:"@Modifying bulk update bypasses the persistence context",
 goal:"Fast set-based updates — and the stale objects they leave behind.",
 steps:[
 {n:"pc",t:"Entity already loaded",w:"Payment p = repo.findById(42)  // status=PENDING",d:[],c:{"PERSISTENCE CONTEXT|managed":"Payment#42 (status=PENDING)"},f:"—",iv:"—"},
 {n:"declared",t:"Bulk JPQL update",w:"@Modifying @Query(\"update Payment p set p.status = 'EXPIRED' where p.createdAt < :cutoff\") int expireOld(…)",d:["executeUpdate: straight to the database."],c:{"SQL|sent":"update payment set status='EXPIRED' where created_at < ?","RESULT|rows":"250 updated"},f:"Missing @Modifying → InvalidDataAccessApiUsageException.",iv:"—"},
 {n:"pc",t:"Context not updated",w:"Payment#42 in memory still says PENDING",d:["A later flush could even write the stale value back.","@Modifying(clearAutomatically = true, flushAutomatically = true) flushes before and clears after."],c:{"PERSISTENCE CONTEXT|managed":"Payment#42 (status=PENDING — stale)"},f:"—",iv:"Bulk @Modifying queries skip the persistence context: flush before, clear after."},
 {n:"declared",t:"Deletes: one by one vs bulk",w:"deleteByStatus(…) / deleteAll() vs deleteAllInBatch() / @Modifying delete",
  d:["Derived deleteBy… and deleteAll() load every entity and call em.remove on each (cascades, @PreRemove, @Version checked).","deleteAllInBatch and @Modifying run one DELETE statement: fast, but skip cascades, lifecycle callbacks, @Version and auditing."],c:{},f:"—",iv:"—"}
 ]},
// =====================================================================
{id:"paging", group:"Reads", name:"Paging, projections and auditing",
 goal:"Everyday repository features and their SQL.",
 steps:[
 {n:"paging",t:"Page request",w:"Page<Payment> findByStatus(PaymentStatus s, Pageable pageable) with PageRequest.of(0, 20, Sort.by(\"createdAt\").descending())",d:[],c:{"CALL|method":"findByStatus(COMPLETED, page 0 size 20)"},f:"—",iv:"—"},
 {n:"jdbc",t:"Two queries for a Page",w:"select … order by created_at desc offset 0 rows fetch first 20 rows only; select count(…)",d:["The count is skipped when it can be computed (first page not full, or last page).","Slice<Payment> never counts (fetches 21 rows to know if there's a next page).","Exact SQL depends on the dialect."],c:{"SQL|sent":"select … limit 20 + select count(*)","RESULT|page":"20 items, totalElements=4312"},f:"—",iv:"Page = data + count query; Slice = data only, cheaper for infinite scroll."},
 {n:"projection",t:"Interface projection",w:"interface PaymentSummary { Long getId(); BigDecimal getAmount(); } List<PaymentSummary> findByStatus(…)",d:["Selects only id and amount; results are read-only proxies, not managed entities."],c:{"SQL|sent":"select p.id, p.amount from payment p where …"},f:"—",iv:"—"},
 {n:"audit",t:"Auditing fields",w:"@EnableJpaAuditing + @EntityListeners(AuditingEntityListener.class) + @CreatedDate / @CreatedBy",
  d:["AuditingEntityListener fills them on persist/update.","AuditorAware bean can read SecurityContextHolder → createdBy = JWT subject."],c:{"ENTITY|createdBy":"nithin","ENTITY|createdAt":"2026-09-27T15:10Z"},f:"—",iv:"—"},
 {n:"jdbc",t:"Batch inserts",w:"saveAll(1000 payments) + hibernate.jdbc.batch_size=50 + order_inserts=true",d:["Groups INSERTs into JDBC batches — only with SEQUENCE/TABLE ids, not IDENTITY."],c:{"SQL|sent":"20 JDBC batches of 50 inserts"},f:"—",iv:"—"}
 ]},
// =====================================================================
{id:"assoc", group:"Writes", name:"Associations: owning side, cascade, orphanRemoval",
 goal:"Bidirectional one-to-many done right — the source of many 'my child wasn't saved' bugs.",
 steps:[
 {n:"entity",t:"The mapping",w:"Payment: @OneToMany(mappedBy = \"payment\", cascade = ALL, orphanRemoval = true) List<PaymentItem> items; PaymentItem: @ManyToOne(fetch = LAZY) Payment payment",
  d:["The @ManyToOne side (the table with the foreign key) is the OWNING side.","mappedBy marks the inverse side: changes only there are NOT written."],c:{},f:"—",iv:"The owning side is the one with the foreign key (@ManyToOne); mappedBy is the inverse side and is ignored for writes."},
 {n:"assoc",t:"Add an item correctly",w:"payment.addItem(item) { items.add(item); item.setPayment(this); }",
  d:["Keep BOTH sides in sync with a helper method.","Only items.add(item) → item.payment stays null → payment_id null (or constraint error)."],c:{"ENTITY|item.payment":"Payment#42 (owning side set)"},f:"Setting only the inverse side → child saved without the foreign key.",iv:"—"},
 {n:"actionq",t:"Cascade on flush",w:"cascade = ALL → persist cascades to new items",d:["INSERT payment_item … payment_id=42 at flush."],c:{"SQL|sent":"insert into payment_item (payment_id, …) values (42, …)"},f:"No cascade → TransientPropertyValueException 'object references an unsaved transient instance'.",iv:"—"},
 {n:"assoc",t:"orphanRemoval",w:"payment.getItems().remove(item) → DELETE at flush",d:["Removing from the collection deletes the row (orphan removals run first in the ActionQueue)."],c:{"SQL|sent":"delete from payment_item where id=?"},f:"—",iv:"—"},
 {n:"assoc",t:"getReferenceById vs findById",w:"repo.getReferenceById(42) → em.getReference (proxy, no SELECT)",
  d:["Perfect for setting a foreign key: item.setPayment(repo.getReferenceById(42)).","If the row doesn't exist, EntityNotFoundException appears only when the proxy is touched."],c:{"ENTITY|reference":"Payment proxy (not loaded)"},f:"—",iv:"getReferenceById returns a lazy proxy without a query; findById hits the database (or the persistence context)."},
 {n:"entity",t:"equals/hashCode for entities",w:"generated @Id is null before persist",
  d:["Don't use Lombok @Data/@EqualsAndHashCode on entities: hashCode over all fields changes as fields change, and can trigger lazy loading.","Use a business key, or id-based equals with a constant hashCode."],c:{},f:"An entity put into a HashSet before persist 'disappears' after the id is assigned.",iv:"—"}
 ]},
{id:"dynamic", group:"Reads", name:"Dynamic search: Specification, Query by Example, scrolling",
 goal:"Queries whose WHERE clause depends on which filters the user filled in.",
 steps:[
 {n:"spec",t:"Specifications",w:"PaymentRepository extends JpaSpecificationExecutor<Payment>; repo.findAll(hasStatus(s).and(createdAfter(d)), pageable)",
  d:["Each Specification builds a Criteria predicate; null specs are skipped, so optional filters compose cleanly."],c:{"SQL|sent":"select … where status=? and created_at>? (only filled filters)"},f:"—",iv:"Use Specifications (Criteria API) for optional filter combinations instead of many findBy… methods."},
 {n:"spec",t:"Query by Example",w:"repo.findAll(Example.of(probe, ExampleMatcher.matching().withIgnoreNullValues()))",d:["Simple equality/string matching from a sample object; no ranges or OR logic."],c:{},f:"—",iv:"—"},
 {n:"paging",t:"Keyset scrolling",w:"Window<Payment> findTop20ByStatusOrderByIdAsc(PaymentStatus s, ScrollPosition position)",
  d:["ScrollPosition.keyset() continues after the last seen id: no OFFSET scan, stable under inserts — good for large exports/feeds."],c:{"SQL|sent":"select … where status=? and id > ? order by id limit 20"},f:"—",iv:"—"}
 ]},
{id:"l2cache", group:"Reads", name:"First-level vs second-level cache",
 goal:"What is cached where, and for how long.",
 steps:[
 {n:"pc",t:"First-level cache",w:"persistence context (always on)",d:["Per transaction/EntityManager: same id → same object, no second SELECT.","Gone when the transaction ends."],c:{"PERSISTENCE CONTEXT|scope":"this transaction only"},f:"—",iv:"—"},
 {n:"l2",t:"Second-level cache",w:"hibernate.cache.use_second_level_cache + JCache provider (e.g. Ehcache/Caffeine) + @Cache on the entity",
  d:["Shared across transactions in this JVM: findById may skip SQL entirely.","Query cache (hibernate.cache.use_query_cache) caches id lists of query results.","Each instance has its own cache → stale data across instances unless the provider is distributed."],c:{"PERSISTENCE CONTEXT|scope":"L2: whole JVM"},f:"Bulk updates / other services writing the table make L2 entries stale.",
  iv:"L1 = per transaction, automatic; L2 = per JVM/cluster, opt-in per entity — good for reference data, risky for frequently changed rows."}
 ]}
];