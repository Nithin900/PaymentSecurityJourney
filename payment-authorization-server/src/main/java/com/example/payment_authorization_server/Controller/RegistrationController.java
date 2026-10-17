// INSTRUCTIONS (no code yet)
// Purpose: public HTTP endpoint to create users.
// 1. Add `package com.example.payment_authorization_server.Controller;`
// 2. Mark as @RestController.
// 3. Expose POST /register accepting RegisterRequest (validated with @Valid),
//    delegating to UserRegistrationService, returning 201 Created.
// 4. Remember to permit this path in SecurityConfig (see SecurityConfig notes)
//    and to ignore CSRF for it, or the POST will be rejected/redirected to login.
