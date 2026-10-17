// INSTRUCTIONS (no code yet)
// Purpose: business logic for creating new users.
// 1. Add `package com.example.payment_authorization_server.Service;`
// 2. Mark as a Spring @Service; inject UserRepository and PasswordEncoder.
// 3. register(request): validate username not already taken (throw a
//    UserAlreadyExistsException if so), hash the raw password with the
//    PasswordEncoder, set default role USER and enabled=true, save, and
//    return something safe (id + username only, never the hash).
// 4. Wrap in a transaction.
package com.example.payment_authorization_server.Service;

import com.example.payment_authorization_server.DTO.RegisterRequest;
import com.example.payment_authorization_server.DTO.RegisterResponse;
import com.example.payment_authorization_server.Entity.UserEntity;
import com.example.payment_authorization_server.Exception.UserAlreadyExistsException;
import com.example.payment_authorization_server.Repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserRegistrationService
{
    private final UserRepository repo;
    private final PasswordEncoder passwordEncoder;

    public UserRegistrationService(UserRepository repo, PasswordEncoder passwordEncoder) {
        this.repo = repo;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public RegisterResponse register(RegisterRequest registerRequest) {
        if (repo.existsByUsername(registerRequest.username())) {
            throw new UserAlreadyExistsException("Username already taken: " + registerRequest.username());

        }
        UserEntity user = new UserEntity();
        user.setUsername(registerRequest.username());
        user.setPassword(passwordEncoder.encode(registerRequest.password()));
        user.setEmail(registerRequest.email());
        user.setEnabled(true);

        UserEntity savedUser = repo.save(user);
        return new RegisterResponse(savedUser.getId(), savedUser.getUsername());
    }
}