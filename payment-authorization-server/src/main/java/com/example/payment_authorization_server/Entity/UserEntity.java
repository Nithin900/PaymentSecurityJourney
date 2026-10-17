package com.example.payment_authorization_server.Entity;

// INSTRUCTIONS FOR FILLING THIS CLASS (your existing code is kept as-is)
// Purpose: JPA entity for a login user stored in the database.
//
// CLASS LEVEL
//  - Add @Table(name = "users"). Do not rely on the default name "user_entity",
//    and avoid the name "user": it is a reserved word in H2/Postgres.
//
// FIELDS (annotate the existing ones, then add the missing ones)
//  - id: use @GeneratedValue(strategy = GenerationType.IDENTITY) so it auto-increments
//    the same way on H2 and MySQL.
//  - username: @Column(nullable = false, unique = true, length = 50).
//    Unique constraint is what finally protects against duplicate registrations.
//  - password: @Column(nullable = false, length = 100). Stores the BCrypt HASH only
//    (BCrypt output is ~60 chars; the delegating encoder adds a "{bcrypt}" prefix).
//    Never store or log the raw password.
//  - email: @Column(nullable = false, unique = true) if you want one account per email.
//  - firstName / lastName: plain columns, nullable is fine.
//  - ADD enabled: boolean, @Column(nullable = false), default true. Spring Security
//    uses it to block disabled accounts at login.
//  - ADD roles: simplest is a String like "USER" or "USER,ADMIN" (split on comma in
//    CustomUserDetailsService). Do NOT put the "ROLE_" prefix in the DB; add it
//    when building authorities.
//  - OPTIONAL createdAt: Instant, set when the row is first saved (@PrePersist or
//    @CreationTimestamp).
//
// BOILERPLATE
//  - Add a public no-arg constructor (JPA requires it) plus getters and setters,
//    or use Lombok @Getter/@Setter if the project already uses Lombok.
//    Avoid Lombok @Data on entities (generated equals/hashCode can misbehave).
//
// RULES
//  - Keep it a plain data class: no Spring Security types (UserDetails etc.) in here.
//  - The class-level mapping to the table is created automatically by
//    spring.jpa.hibernate.ddl-auto=update in application.yaml.
//
// CHECK WHEN DONE
//  - Start the app, then open the H2 data file / console and confirm a USERS table
//    with the expected columns and unique constraints exists.

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.ToString;

@Entity

@Table(name = "users")
public class UserEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String username;
    @Column(nullable = false, length = 100)
    private String password;

    @Column(nullable = false, unique = true)
    private String email;
    @Column(nullable = false)
    public boolean enabled = true;

    @Column(nullable = false,length=100)
    private String roles="USER";

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }
    public String getRoles() {
        return roles;
    }
    public void setRoles(String roles) {
        this.roles = roles;
    }
}
