package com.example.payment_authorization_server.Config;

import com.example.payment_authorization_server.Entity.UserEntity;
import com.example.payment_authorization_server.Repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.WebAttributes;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;

/**
 * Form-login failure handler: still redirects to /login?error (302), but when the account is
 * locked it swaps the generic "Bad credentials" for "try again in N seconds".
 * It reads the lock from the database, so the attempt that triggers the lock shows it too.
 */
@Component
public class LockoutAwareFailureHandler implements AuthenticationFailureHandler {

    private final UserRepository userRepo;

    public LockoutAwareFailureHandler(UserRepository userRepo) {
        this.userRepo = userRepo;
    }

    @Override
    public void onAuthenticationFailure(HttpServletRequest request, HttpServletResponse response,
                                        AuthenticationException exception) throws IOException {
        AuthenticationException shown = exception;

        String username = request.getParameter("username");
        if (username != null) {
            Instant lockedUntil = userRepo.findByUsername(username)
                    .map(UserEntity::getLockedUntil)
                    .orElse(null);
            if (lockedUntil != null && lockedUntil.isAfter(Instant.now())) {
                long seconds = Duration.between(Instant.now(), lockedUntil).toSeconds() + 1;
                shown = new LockedException("Too many failed attempts. Try again in " + seconds + " seconds.");
            }
        }

        // the generated login page prints the message of this stored exception
        request.getSession().setAttribute(WebAttributes.AUTHENTICATION_EXCEPTION, shown);
        response.sendRedirect(request.getContextPath() + "/login?error");
    }
}
