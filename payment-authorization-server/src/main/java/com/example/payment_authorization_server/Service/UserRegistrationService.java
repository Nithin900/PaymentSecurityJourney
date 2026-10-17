// INSTRUCTIONS (no code yet)
// Purpose: business logic for creating new users.
// 1. Add `package com.example.payment_authorization_server.Service;`
// 2. Mark as a Spring @Service; inject UserRepository and PasswordEncoder.
// 3. register(request): validate username not already taken (throw a
//    UserAlreadyExistsException if so), hash the raw password with the
//    PasswordEncoder, set default role USER and enabled=true, save, and
//    return something safe (id + username only, never the hash).
// 4. Wrap in a transaction.
