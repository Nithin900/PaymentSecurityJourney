package com.example.payment_authorization_server;

import com.example.payment_authorization_server.Entity.UserEntity;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrlPattern;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Exercise A2 (Build step 6), tightened after the open-/register finding: POST /register is
 * admin-only, safe, and does not open other doors. No CSRF token is sent on purpose: that is
 * how a script calls it, and only /register is excluded from CSRF.
 */
@DisplayName("A2 - POST /register")
class ExA2_RegisterEndpointTest extends AuthServerTestBase {

    @Autowired PasswordEncoder passwordEncoder;

    private MockHttpServletRequestBuilder registerRequest(String username, String password, String email) {
        String json = "{\"username\":\"" + username + "\",\"password\":\"" + password + "\",\"email\":\"" + email + "\"}";
        return post("/register").contentType(MediaType.APPLICATION_JSON).content(json);
    }

    /** Register as an admin: the happy path the A2.1 to A2.4 rules are checked on. */
    private ResultActions register(String username, String password, String email) throws Exception {
        return mvc.perform(registerRequest(username, password, email).with(user("admin").roles("ADMIN")));
    }

    @Test
    @DisplayName("A2.1 admin register returns 201 with id and username, never the password or hash")
    void registerCreated() throws Exception {
        register("ravi", "Secret#123", "ravi@test.com")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.username").value("ravi"))
                .andExpect(jsonPath("$.password").doesNotExist())
                .andExpect(content().string(not(containsString("Secret#123"))))
                .andExpect(content().string(not(containsString("$2"))));
    }

    @Test
    @DisplayName("A2.2 duplicate username returns 409")
    void duplicateIs409() throws Exception {
        register("ravi", "Secret#123", "ravi@test.com").andExpect(status().isCreated());

        register("ravi", "Other#4567", "ravi2@test.com").andExpect(status().isConflict());
    }

    @Test
    @DisplayName("A2.3 password shorter than 8 characters returns 400")
    void shortPasswordIs400() throws Exception {
        register("ravi", "short", "ravi@test.com").andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("A2.4 blank username returns 400")
    void blankUsernameIs400() throws Exception {
        register("", "Secret#123", "ravi@test.com").andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("A2.5 other pages still need login (a browser is redirected to /login)")
    void otherPagesStillProtected() throws Exception {
        // a browser asks for HTML; a client that does not gets 401 from Basic auth instead
        mvc.perform(get("/some-other-page").accept(MediaType.TEXT_HTML))
                .andExpect(status().is3xxRedirection())
                .andExpect(redirectedUrlPattern("**/login"));
    }

    @Test
    @DisplayName("A2.6 CSRF is still on for the login form (only /register is excluded)")
    void csrfStillOnForLogin() throws Exception {
        mvc.perform(post("/login").param("username", "ravi").param("password", "Secret#123"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("A2.7 anonymous register returns 401 and creates nothing")
    void anonymousIs401() throws Exception {
        mvc.perform(registerRequest("ravi", "Secret#123", "ravi@test.com"))
                .andExpect(status().isUnauthorized());

        org.assertj.core.api.Assertions.assertThat(users.findByUsername("ravi")).isEmpty();
    }

    @Test
    @DisplayName("A2.8 a normal user gets 403 and creates nothing")
    void normalUserIs403() throws Exception {
        mvc.perform(registerRequest("ravi", "Secret#123", "ravi@test.com").with(user("bob").roles("USER")))
                .andExpect(status().isForbidden());

        org.assertj.core.api.Assertions.assertThat(users.findByUsername("ravi")).isEmpty();
    }

    @Test
    @DisplayName("A2.9 an admin gets 201")
    void adminIs201() throws Exception {
        register("ravi", "Secret#123", "ravi@test.com").andExpect(status().isCreated());
    }

    @Test
    @DisplayName("A2.10 a script can call it with Basic auth as an admin stored in the database")
    void basicAuthAdminIs201() throws Exception {
        UserEntity admin = new UserEntity();
        admin.setUsername("boss");
        admin.setPassword(passwordEncoder.encode("Admin#12345"));
        admin.setEmail("boss@test.com");
        admin.setRoles("ADMIN");
        users.save(admin);

        mvc.perform(registerRequest("ravi", "Secret#123", "ravi@test.com").with(httpBasic("boss", "Admin#12345")))
                .andExpect(status().isCreated());
        mvc.perform(registerRequest("sam", "Secret#123", "sam@test.com").with(httpBasic("boss", "wrong-password")))
                .andExpect(status().isUnauthorized());
    }
}
