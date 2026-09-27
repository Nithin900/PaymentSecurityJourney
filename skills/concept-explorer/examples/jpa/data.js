var NODES = [
 // ---- repository ----
 ["iface","Your repository interface","PaymentRepository extends JpaRepository",20,45,210,"repo","Only an interface. Spring Data generates the implementation at startup."],
 ["factory","Repository factory","JpaRepositoryFactoryBean → JpaRepositoryFactory",20,85,210,"repo","Registered by @EnableJpaRepositories (auto-configured). Builds a proxy per repository interface."],
 ["rproxy","Repository proxy","JDK proxy + interceptors",20,125,210,"repo","Implements your interface. Interceptor chain: exception translation → transaction (TransactionInterceptor) → query methods → SimpleJpaRepository."],
 ["simple","SimpleJpaRepository","default CRUD implementation",20,165,210,"repo","save, findById, findAll, delete… Class-level @Transactional(readOnly = true); write methods @Transactional."],
 ["lookup","Query lookup","QueryExecutorMethodInterceptor",20,205,210,"repo","At startup, resolves every query method once (QueryLookupStrategy CREATE_IF_NOT_FOUND): @Query → declared query, otherwise derive from the method name."],
 ["derived","Derived query","PartTreeJpaQuery",20,245,210,"repo","findByStatusAndAmountGreaterThan → parsed into a PartTree → JPQL/criteria query. Property names are checked against the entity."],
 ["declared","@Query","SimpleJpaQuery / NativeJpaQuery",20,285,210,"repo","Your JPQL or native SQL. @Modifying for UPDATE/DELETE."],
 ["spec","Specifications / QBE","JpaSpecificationExecutor",20,365,210,"repo","Dynamic queries built from Criteria predicates (Specification) or a sample object (Query by Example)."],
 ["xlate","Exception translation","PersistenceExceptionTranslationInterceptor",20,325,210,"repo","Turns JPA/Hibernate exceptions into Spring's DataAccessException hierarchy (DataIntegrityViolationException, OptimisticLockingFailureException…)."],
 // ---- persistence context ----
 ["sharedem","Shared EntityManager","SharedEntityManagerCreator proxy",250,45,220,"pc","The EntityManager injected into repositories is a proxy; each call goes to the EntityManager bound to the current transaction (thread)."],
 ["pc","Persistence context","first-level cache (Hibernate Session)",250,85,220,"pc","Map of managed entities by id for this transaction. Same id → same Java object. Keeps a snapshot of each entity for dirty checking."],
 ["states","Entity states","transient · managed · detached · removed",250,125,220,"pc","new Payment() = transient; after persist/find = managed; after the context closes = detached; after remove = removed."],
 ["actionq","Action queue","ActionQueue",250,165,220,"pc","Pending INSERT/UPDATE/DELETE actions, executed in a fixed order at flush."],
 ["flush","Flush","dirty checking",250,205,220,"pc","Compares every managed entity with its snapshot and queues UPDATEs. Happens before commit, before queries that touch dirty tables (FlushMode.AUTO), or on flush()."],
 ["l2","Second-level cache","@Cache + JCache provider",250,285,220,"pc","Optional cache shared across transactions in the JVM (entities, collections, query results)."],
 ["merge","merge()","copy detached state",250,245,220,"pc","Loads (or finds) the managed instance with that id and copies the detached object's fields into it. Returns the MANAGED copy, not your object."],
 // ---- loading ----
 ["lazy","Lazy loading","Hibernate proxy / PersistentBag",490,45,210,"load","LAZY associations are placeholders; the SQL runs when you first touch them, only while the persistence context is open."],
 ["eagerdef","Fetch defaults","@ManyToOne EAGER by default",490,85,210,"load","JPA defaults: @ManyToOne/@OneToOne EAGER, @OneToMany/@ManyToMany LAZY. Mark every association LAZY and fetch what you need per query."],
 ["nplus1","N+1 queries","1 list query + N association queries",490,125,210,"load","Loading N parents and touching a lazy association on each → N extra SELECTs."],
 ["fetchjoin","Fetch join / entity graph","JOIN FETCH, @EntityGraph",490,165,210,"load","Load the association in the same query."],
 ["batchfetch","Batch fetching","hibernate.default_batch_fetch_size",490,205,210,"load","Loads lazy associations for many parents with one IN (…) query instead of N queries."],
 ["assoc","Associations","owning side, cascade, orphanRemoval",490,325,210,"load","@OneToMany(mappedBy)/@ManyToOne: the foreign-key side owns the relationship; cascade and orphanRemoval control child writes."],
 ["projection","Projections","interface / record DTO",490,245,210,"load","Select only the needed columns into a read-only view; no managed entities, no dirty checking."],
 ["paging","Paging","Pageable → Page / Slice",490,285,210,"load","Adds limit/offset; Page also runs a COUNT query, Slice doesn't."],
 // ---- concurrency ----
 ["version","Optimistic locking","@Version",720,45,200,"lock","UPDATE … WHERE id=? AND version=?; 0 rows → someone else changed it → exception."],
 ["pessimistic","Pessimistic locking","@Lock(PESSIMISTIC_WRITE)",720,85,200,"lock","SELECT … FOR UPDATE: other transactions wait until this one commits."],
 ["audit","Auditing","AuditingEntityListener",720,125,200,"lock","@CreatedDate, @LastModifiedDate, @CreatedBy filled automatically (@EnableJpaAuditing, AuditorAware)."],
 // ---- jdbc ----
 ["jdbc","JDBC statements","Hibernate → PreparedStatement",720,185,200,"jdbc","SQL with bind parameters; batching with hibernate.jdbc.batch_size (not for IDENTITY inserts)."],
 ["hikari","Connection","HikariCP",720,225,200,"jdbc","The transaction's connection."],
 ["db","Database","constraints, locks",720,265,200,"jdbc","Enforces unique/foreign keys, holds row locks, returns update counts."],
 // ---- your code ----
 ["entity","Payment entity","@Entity",20,460,190,"you","Your mapped class: @Id, @GeneratedValue, @Version, associations."],
 ["repo","PaymentRepository","your interface",220,460,190,"you","Query methods and @Query."],
 ["svc","PaymentService","@Transactional",420,460,190,"you","Where the transaction (and the persistence context) lives."]
];
var GROUPS = [
 ["Spring Data repository",10,22,230,380],["Persistence context (Hibernate)",240,22,240,300],["Loading data",480,22,230,340],
 ["Concurrency & auditing",710,22,220,140],["JDBC",710,165,220,140],["Your code",10,440,1150,60]
];
var OWN = {
 spec:["write","extends JpaSpecificationExecutor + your Specification factory methods."],
 l2:["config","spring.jpa.properties.hibernate.cache.* + a JCache provider + @Cache on entities."],
 assoc:["write","Your association mappings and add/remove helper methods."],
 iface:["write","Your interface; no implementation class."],
 factory:["spring","Auto-configured (JpaRepositoriesAutoConfiguration)."],
 rproxy:["spring","Generated."],
 simple:["spring","Provided; you can add custom methods with a PaymentRepositoryCustom + Impl class."],
 lookup:["spring","Automatic at startup."],
 derived:["write","Your method names: findByStatus, existsByReference, countByStatus…"],
 declared:["write","Your @Query strings (@Modifying for bulk updates)."],
 xlate:["spring","Automatic for repositories."],
 sharedem:["spring","Injected with @PersistenceContext or constructor injection; you rarely need it."],
 pc:["spring","Scoped to your @Transactional method (or the web request with OSIV)."],
 states:["spring","A model to reason about; you trigger transitions with persist/find/merge/remove."],
 actionq:["spring","Internal."],
 flush:["config","Automatic; repository.flush()/saveAndFlush() to force it early."],
 merge:["spring","Used by save() for entities that aren't new."],
 lazy:["config","fetch = FetchType.LAZY on associations."],
 eagerdef:["config","Write fetch = LAZY on @ManyToOne/@OneToOne yourself."],
 nplus1:["config","Caused by how you query; see it with spring.jpa.show-sql or a SQL counter in tests."],
 fetchjoin:["write","@Query(\"select p from Payment p join fetch p.items where …\") or @EntityGraph(attributePaths = \"items\")."],
 batchfetch:["config","spring.jpa.properties.hibernate.default_batch_fetch_size=50 or @BatchSize."],
 projection:["write","An interface with getters or a record as the repository return type."],
 paging:["write","Pageable parameter; Page or Slice return type."],
 version:["write","@Version Long version field on the entity."],
 pessimistic:["write","@Lock(LockModeType.PESSIMISTIC_WRITE) on a repository method."],
 audit:["config","@EnableJpaAuditing, @EntityListeners(AuditingEntityListener.class), an AuditorAware bean (e.g. from SecurityContext)."],
 jdbc:["config","spring.jpa.properties.hibernate.jdbc.batch_size, order_inserts."],
 hikari:["config","spring.datasource.hikari.*"],
 db:["ext","Your database schema and constraints."],
 entity:["write","Your @Entity class."],
 repo:["write","Your repository interface."],
 svc:["write","Your @Transactional service."]
};
var SECTIONS = ["CALL","PERSISTENCE CONTEXT","ENTITY","SQL","TRANSACTION","RESULT"];
