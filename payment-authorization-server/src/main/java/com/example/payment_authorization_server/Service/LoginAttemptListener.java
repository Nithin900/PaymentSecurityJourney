package com.example.payment_authorization_server.Service;

import com.example.payment_authorization_server.Repository.UserRepository;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.authentication.event.AuthenticationFailureBadCredentialsEvent;
import org.springframework.security.authentication.event.AuthenticationSuccessEvent;

import java.time.Duration;
import java.time.Instant;

@Component
public class LoginAttemptListener  {
     static final int MAX_FAILED_ATTEMPTS = 5;
     static final Duration MAX_FAILED_ATTEMPT_DURATION = Duration.ofMinutes(15);

     private final UserRepository userRepo;
     public LoginAttemptListener(UserRepository userRepo, UserRepository userRepo1) {
         this.userRepo = userRepo1;
     }

     //wrong password (also fires for unknowm usernames, so the user may not exist
    @EventListener
    @Transactional
    public void onBoardPassword(AuthenticationFailureBadCredentialsEvent event)

    {
    String username=event.getAuthentication().getName();
    userRepo.findByUsername(username).ifPresent(user -> {
        int attempts = user.getFailedAttempts()+1;
        user.setFailedAttempts(attempts);
        if(attempts >= MAX_FAILED_ATTEMPTS) {
            user.setLockedUntil(Instant.now().plus(MAX_FAILED_ATTEMPT_DURATION));
        }
        userRepo.save(user);
    });
    }
    //Successful login: start counting from sero again
    @EventListener
    @Transactional
    public void onSuccess(AuthenticationSuccessEvent event)
    {
        String username=event.getAuthentication().getName();
        userRepo.findByUsername(username).ifPresent(user -> {
            user.setFailedAttempts(0);
            user.setLockedUntil(null);
            userRepo.save(user);
        });
    }
}
