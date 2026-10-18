package com.example.payment_authorization_server.Config;

import com.example.payment_authorization_server.Entity.UserEntity;
import com.example.payment_authorization_server.Repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Creates the first admin at startup, because /register now needs an admin to exist.
 * Does nothing unless ADMIN_PASSWORD is set, and never touches an existing user.
 */
@Component
public class AdminSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminSeeder.class);

    private final UserRepository userRepo;
    private final PasswordEncoder passwordEncoder;
    private final String username;
    private final String password;
    private final String email;

    public AdminSeeder(UserRepository userRepo, PasswordEncoder passwordEncoder,
                       @Value("${admin.username}") String username,
                       @Value("${admin.password}") String password,
                       @Value("${admin.email}") String email) {
        this.userRepo = userRepo;
        this.passwordEncoder = passwordEncoder;
        this.username = username;
        this.password = password;
        this.email = email;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (password.isBlank()) {
            log.warn("ADMIN_PASSWORD is not set: no admin seeded, so POST /register cannot be used until one exists");
            return;
        }
        if (password.length() < 8) {
            throw new IllegalStateException("ADMIN_PASSWORD must be at least 8 characters");
        }
        if (userRepo.existsByUsername(username)) {
            return;
        }
        UserEntity admin = new UserEntity();
        admin.setUsername(username);
        admin.setPassword(passwordEncoder.encode(password));
        admin.setEmail(email);
        admin.setRoles("ADMIN");
        userRepo.save(admin);
        log.info("Seeded admin user '{}'", username);
    }
}
