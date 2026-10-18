package com.example.payment_authorization_server;

import com.example.payment_authorization_server.Repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Shared setup for the practice tests.
 * - "dev" profile: in-memory RSA key, so no KEYSTORE_PATH is needed.
 * - H2 in memory instead of Postgres, so tests run without a database server.
 * - Tracing off, so tests do not try to reach Zipkin.
 * Every test starts with an empty users table.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:practice;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "management.tracing.enabled=false",
        "logging.level.org.springframework.security=info"
})
public abstract class AuthServerTestBase {

    @Autowired
    protected MockMvc mvc;

    @Autowired
    protected UserRepository users;

    @BeforeEach
    void emptyUsersTable() {
        users.deleteAll();
    }
}
