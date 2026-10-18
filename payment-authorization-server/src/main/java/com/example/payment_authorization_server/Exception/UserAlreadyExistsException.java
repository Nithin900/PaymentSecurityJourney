// INSTRUCTIONS (no code yet)
// Purpose: signal a duplicate username during registration.
// 1. Add `package com.example.payment_authorization_server.Exception;`
// 2. Extend RuntimeException with a message constructor.
// 3. Optionally add a @RestControllerAdvice in this package mapping it to
//    HTTP 409 Conflict and validation errors to 400.
package com.example.payment_authorization_server.Exception;

public class UserAlreadyExistsException extends RuntimeException {
    public UserAlreadyExistsException(String message) {
        super(message);
    }
}