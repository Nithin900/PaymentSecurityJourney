package com.example.payment_authorization_server;

import com.example.payment_authorization_server.DTO.RegisterRequest;
import com.example.payment_authorization_server.DTO.RegisterResponse;
import com.example.payment_authorization_server.Entity.UserEntity;
import com.example.payment_authorization_server.Exception.UserAlreadyExistsException;
import com.example.payment_authorization_server.Service.CustomUserDetailsService;
import com.example.payment_authorization_server.Service.UserRegistrationService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.lang.reflect.RecordComponent;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestBuilders.formLogin;
import static org.springframework.security.test.web.servlet.response.SecurityMockMvcResultMatchers.authenticated;
import static org.springframework.security.test.web.servlet.response.SecurityMockMvcResultMatchers.unauthenticated;

/**
 * Exercise A1 (Build step 6): users live in the database, passwords are BCrypt hashes.
 * Write a prediction in EXERCISES.md before you run each test for the first time.
 */
@DisplayName("A1 - users from the database, BCrypt passwords")
class ExA1_DbUsersTest extends AuthServerTestBase {

    @Autowired UserRegistrationService registration;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired UserDetailsService userDetailsService;

    private RegisterResponse register(String username, String password) {
        return registration.register(new RegisterRequest(username, password, username + "@test.com"));
    }

    @Test
    @DisplayName("A1.1 stored password is a {bcrypt} hash, never the raw password")
    void storesBcryptHash() {
        register("ravi", "Secret#123");

        UserEntity saved = users.findByUsername("ravi").orElseThrow();
        assertThat(saved.getPassword()).startsWith("{bcrypt}$2").doesNotContain("Secret#123");
        assertThat(passwordEncoder.matches("Secret#123", saved.getPassword())).isTrue();
    }

    @Test
    @DisplayName("A1.2 register() returns only id and username")
    void returnsOnlySafeFields() {
        RegisterResponse response = register("ravi", "Secret#123");

        UserEntity saved = users.findByUsername("ravi").orElseThrow();
        assertThat(response.id()).isEqualTo(saved.getId());
        assertThat(response.username()).isEqualTo("ravi");
        assertThat(RegisterResponse.class.getRecordComponents())
                .extracting(RecordComponent::getName)
                .containsExactlyInAnyOrder("id", "username");
    }

    @Test
    @DisplayName("A1.3 new users are enabled and get ROLE_USER")
    void newUserEnabledWithRoleUser() {
        register("ravi", "Secret#123");

        UserEntity saved = users.findByUsername("ravi").orElseThrow();
        assertThat(saved.isEnabled()).isTrue();

        UserDetails details = userDetailsService.loadUserByUsername("ravi");
        assertThat(details.getPassword()).isEqualTo(saved.getPassword());
        assertThat(details.getAuthorities())
                .extracting(GrantedAuthority::getAuthority)
                .containsExactly("ROLE_USER");
    }

    @Test
    @DisplayName("A1.4 the only UserDetailsService bean is the database one")
    void databaseUserDetailsServiceIsUsed() {
        assertThat(userDetailsService).isInstanceOf(CustomUserDetailsService.class);
    }

    @Test
    @DisplayName("A1.5 unknown username throws UsernameNotFoundException")
    void unknownUser() {
        assertThatThrownBy(() -> userDetailsService.loadUserByUsername("nobody"))
                .isInstanceOf(UsernameNotFoundException.class);
    }

    @Test
    @DisplayName("A1.6 duplicate username is rejected and only one row exists")
    void duplicateRejected() {
        register("ravi", "Secret#123");

        assertThatThrownBy(() -> register("ravi", "Other#4567"))
                .isInstanceOf(UserAlreadyExistsException.class);
        assertThat(users.count()).isEqualTo(1);
    }

    @Test
    @DisplayName("A1.7 form login with the right password works")
    void loginWithRightPassword() throws Exception {
        register("ravi", "Secret#123");

        mvc.perform(formLogin().user("ravi").password("Secret#123"))
                .andExpect(authenticated().withUsername("ravi").withRoles("USER"));
    }

    @Test
    @DisplayName("A1.8 form login with a wrong password fails")
    void loginWithWrongPassword() throws Exception {
        register("ravi", "Secret#123");

        mvc.perform(formLogin().user("ravi").password("wrong-password"))
                .andExpect(unauthenticated());
    }

    @Test
    @DisplayName("A1.9 a disabled user cannot log in, even with the right password")
    void disabledUserCannotLogIn() throws Exception {
        register("ravi", "Secret#123");
        UserEntity user = users.findByUsername("ravi").orElseThrow();
        user.setEnabled(false);
        users.save(user);

        mvc.perform(formLogin().user("ravi").password("Secret#123"))
                .andExpect(unauthenticated());
    }

    @Test
    @DisplayName("A1.10 the old in-memory user nithin/password no longer works")
    void inMemoryUsersAreGone() throws Exception {
        mvc.perform(formLogin().user("nithin").password("password"))
                .andExpect(unauthenticated());
    }
}
