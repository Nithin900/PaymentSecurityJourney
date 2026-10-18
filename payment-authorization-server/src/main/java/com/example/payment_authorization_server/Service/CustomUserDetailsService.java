package com.example.payment_authorization_server.Service;

import com.example.payment_authorization_server.Entity.UserEntity;
import com.example.payment_authorization_server.Repository.UserRepository;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

// INSTRUCTIONS (no code yet)
// Purpose: bridges the database to Spring Security's login flow.
// 1. Add `package com.example.payment_authorization_server.Service;`
// 2. Mark as a Spring @Service and implement UserDetailsService.
// 3. Inject UserRepository via constructor.
// 4. In loadUserByUsername(username): look the user up; if missing throw
//    UsernameNotFoundException; otherwise build and return a Spring Security
//    UserDetails from the entity (username, stored hash, enabled flag,
//    authorities derived from roles with the "ROLE_" prefix).
// 5. Do NOT hash or compare passwords here; DaoAuthenticationProvider does that.
@Service
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository repo;

    public CustomUserDetailsService(UserRepository repo) {
        this.repo = repo;
    }
    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {

        UserEntity user = repo.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found" + username));
        return User.withUsername(user.getUsername())
                .password(user.getPassword())
                .roles(user.getRoles().split(","))
                .disabled(!user.isEnabled())
                .accountLocked(user.getLockedUntil() != null && user.getLockedUntil().isAfter(java.time.Instant.now()))
                .build();



    }
}