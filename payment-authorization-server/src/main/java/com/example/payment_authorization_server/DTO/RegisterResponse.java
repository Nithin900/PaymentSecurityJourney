// INSTRUCTIONS (no code yet)
// Purpose: safe response body for POST /register.
// 1. Add `package com.example.payment_authorization_server.DTO;`
// 2. A record with: id, username. Never include the password or hash.
package com.example.payment_authorization_server.DTO;

public record RegisterResponse(Long id, String username)
{

}
