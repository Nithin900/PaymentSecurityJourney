package com.example.payment_authorization_server;

import com.example.payment_authorization_server.DTO.RegisterRequest;
import com.example.payment_authorization_server.Entity.UserEntity;
import com.example.payment_authorization_server.Service.UserRegistrationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.web.WebAttributes;
import org.springframework.test.web.servlet.MvcResult;

import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestBuilders.formLogin;
import static org.springframework.security.test.web.servlet.response.SecurityMockMvcResultMatchers.authenticated;
import static org.springframework.security.test.web.servlet.response.SecurityMockMvcResultMatchers.unauthenticated;

/**
 * Exercise B (Build step 7): lock an account for 15 minutes after 5 wrong passwords in a row.
 * Contract: UserEntity gets  int failedAttempts  and  Instant lockedUntil  (null = not locked),
 * with getters and setters. Only start this after every A test is green.
 */
@DisplayName("B - account lockout")
class ExB_LockoutTest extends AuthServerTestBase {

    @Autowired UserRegistrationService registration;

    @BeforeEach
    void createUser() {
        registration.register(new RegisterRequest("ravi", "Secret#123", "ravi@test.com"));
    }

    private void wrongPasswords(int times) throws Exception {
        for (int i = 1; i <= times; i++) {
            mvc.perform(formLogin().user("ravi").password("wrong-" + i)).andExpect(unauthenticated());
        }
    }

    private UserEntity ravi() {
        return users.findByUsername("ravi").orElseThrow();
    }

    @Test
    @DisplayName("B1 after 5 wrong passwords, even the right password is refused with LockedException")
    void lockedAfterFive() throws Exception {
        wrongPasswords(5);

        MvcResult result = mvc.perform(formLogin().user("ravi").password("Secret#123"))
                .andExpect(unauthenticated())
                .andReturn();
        Object error = result.getRequest().getSession().getAttribute(WebAttributes.AUTHENTICATION_EXCEPTION);
        assertThat(error).isInstanceOf(LockedException.class);
    }

    @Test
    @DisplayName("B2 4 wrong passwords do not lock the account")
    void fourIsNotEnough() throws Exception {
        wrongPasswords(4);

        mvc.perform(formLogin().user("ravi").password("Secret#123")).andExpect(authenticated());
    }

    @Test
    @DisplayName("B3 a successful login resets the counter to 0")
    void successResetsCounter() throws Exception {
        wrongPasswords(4);
        mvc.perform(formLogin().user("ravi").password("Secret#123")).andExpect(authenticated());
        assertThat(ravi().getFailedAttempts()).isZero();

        wrongPasswords(4);
        mvc.perform(formLogin().user("ravi").password("Secret#123")).andExpect(authenticated());
    }

    @Test
    @DisplayName("B4 the lock is stored in the database and lasts about 15 minutes")
    void lockStoredForFifteenMinutes() throws Exception {
        wrongPasswords(5);

        Instant now = Instant.now();
        assertThat(ravi().getLockedUntil())
                .isNotNull()
                .isBetween(now.plus(Duration.ofMinutes(14)), now.plus(Duration.ofMinutes(16)));
    }

    @Test
    @DisplayName("B5 once lockedUntil is in the past, the right password works again")
    void lockExpires() throws Exception {
        wrongPasswords(5);
        UserEntity user = ravi();
        user.setLockedUntil(Instant.now().minusSeconds(1));
        users.save(user);

        mvc.perform(formLogin().user("ravi").password("Secret#123")).andExpect(authenticated());
    }

    @Test
    @DisplayName("B6 wrong password for a username that does not exist still fails cleanly")
    void unknownUserDoesNotCrash() throws Exception {
        mvc.perform(formLogin().user("nobody").password("whatever")).andExpect(unauthenticated());
    }
}
