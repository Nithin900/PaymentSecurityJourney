// INSTRUCTIONS (no code yet)
// Purpose: map exceptions to HTTP responses.
// 1. Add `package com.example.payment_authorization_server.Exception;`
// 2. Mark as @RestControllerAdvice.
// 3. UserAlreadyExistsException -> 409 Conflict with a JSON error body.
// 4. MethodArgumentNotValidException -> 400 Bad Request with field errors.
package com.example.payment_authorization_server.Exception;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler{
    public record ErrorResponse(String code, String message) {}

        @ExceptionHandler(UserAlreadyExistsException.class)
        public ResponseEntity<ErrorResponse> userExists(UserAlreadyExistsException ex){
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(new ErrorResponse("USER_ALREADY_EXISTS",ex.getMessage()));
        }

        //The DB unique Constrinat: same email, or two registrations at the same time
    @ExceptionHandler(DataIntegrityViolationException.class)
        public ResponseEntity<ErrorResponse> dbConflict(DataIntegrityViolationException ex){
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ErrorResponse("DB_CONFLICT","Username or email already exists"));
    }
    //@valid failed. Messages never contain the rejected password value.
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> invalid(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .map(e -> e.getField() + ": " + e.getDefaultMessage())
                .collect(Collectors.joining(", "));
        return ResponseEntity.badRequest().body(new ErrorResponse("VALIDATION_ERROR", message));
    }

    //Broken JSON Body
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> badJson(HttpMessageNotReadableException ex) {
        return ResponseEntity.badRequest()
                .body(new ErrorResponse("MALFORMED_REQUEST_BODY", "Request body is not valid JSON"));
    }
    }

