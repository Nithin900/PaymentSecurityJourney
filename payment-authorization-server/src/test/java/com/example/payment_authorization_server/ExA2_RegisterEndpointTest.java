package com.example.payment_authorization_server;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrlPattern;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Exercise A2 (Build step 6): POST /register is public, safe, and does not open other doors.
 * No CSRF token and no login are sent on purpose: that is how a REST client calls it.
 */
@DisplayName("A2 - POST /register")
class ExA2_RegisterEndpointTest extends AuthServerTestBase {

    private ResultActions register(String username, String password, String email) throws Exception {
        String json = "{\"username\":\"" + username + "\",\"password\":\"" + password + "\",\"email\":\"" + email + "\"}";
        return mvc.perform(post("/register").contentType(MediaType.APPLICATION_JSON).content(json));
    }

    @Test
    @DisplayName("A2.1 anonymous register returns 201 with id and username, never the password or hash")
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
    @DisplayName("A2.5 other pages still need login (redirect to /login)")
    void otherPagesStillProtected() throws Exception {
        mvc.perform(get("/some-other-page"))
                .andExpect(status().is3xxRedirection())
                .andExpect(redirectedUrlPattern("**/login"));
    }

    @Test
    @DisplayName("A2.6 CSRF is still on for the login form (only /register is excluded)")
    void csrfStillOnForLogin() throws Exception {
        mvc.perform(post("/login").param("username", "ravi").param("password", "Secret#123"))
                .andExpect(status().isForbidden());
    }
}
