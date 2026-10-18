// INSTRUCTIONS (no code yet)
// Purpose: public HTTP endpoint to create users.
// 1. Add `package com.example.payment_authorization_server.Controller;`
// 2. Mark as @RestController.
// 3. Expose POST /register accepting RegisterRequest (validated with @Valid),
//    delegating to UserRegistrationService, returning 201 Created.
// 4. Remember to permit this path in SecurityConfig (see SecurityConfig notes)
//    and to ignore CSRF for it, or the POST will be rejected/redirected to login.
package com.example.payment_authorization_server.Controller;

import com.example.payment_authorization_server.DTO.RegisterRequest;
import com.example.payment_authorization_server.DTO.RegisterResponse;
import com.example.payment_authorization_server.Repository.UserRepository;
import com.example.payment_authorization_server.Service.UserRegistrationService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class RegistrationController {

    private final UserRegistrationService userRegistrationService;
    @Autowired
    public RegistrationController(UserRegistrationService userRegistrationService) {
        this.userRegistrationService = userRegistrationService;
    }
    @PostMapping("/register")
    public ResponseEntity<RegisterResponse> registerUser(@Valid @RequestBody RegisterRequest request)
    {
        RegisterResponse created = userRegistrationService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }
}