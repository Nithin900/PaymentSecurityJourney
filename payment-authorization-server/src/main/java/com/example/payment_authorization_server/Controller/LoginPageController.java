package com.example.payment_authorization_server.Controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.WebAttributes;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.HtmlUtils;

/**
 * Our own /login page. Spring's generated page stops recognising /login?error once a custom
 * failure handler is set, so the lock message (see LockoutAwareFailureHandler) would never show.
 */
@RestController
public class LoginPageController {

    @GetMapping(value = "/login", produces = "text/html;charset=UTF-8")
    @ResponseBody
    public String login(HttpServletRequest request) {
        String error = "";
        if (request.getParameter("error") != null) {
            String message = "Invalid username or password";
            HttpSession session = request.getSession(false);
            if (session != null
                    && session.getAttribute(WebAttributes.AUTHENTICATION_EXCEPTION) instanceof AuthenticationException ex) {
                message = ex.getMessage();
            }
            error = "<p style=\"color:#b00020\" role=\"alert\">" + HtmlUtils.htmlEscape(message) + "</p>";
        }

        CsrfToken csrf = (CsrfToken) request.getAttribute(CsrfToken.class.getName());
        String csrfField = csrf == null ? ""
                : "<input type=\"hidden\" name=\"" + HtmlUtils.htmlEscape(csrf.getParameterName())
                + "\" value=\"" + HtmlUtils.htmlEscape(csrf.getToken()) + "\"/>";

        return """
                <!DOCTYPE html>
                <html lang="en"><head><meta charset="utf-8"><title>Please sign in</title>
                <meta name="viewport" content="width=device-width, initial-scale=1"></head>
                <body style="font-family:sans-serif;max-width:22rem;margin:4rem auto;padding:0 1rem">
                <h2>Please sign in</h2>
                %s
                <form method="post" action="/login">
                <p><input name="username" placeholder="Username" autofocus required style="width:100%%"></p>
                <p><input name="password" type="password" placeholder="Password" required style="width:100%%"></p>
                %s
                <button type="submit">Sign in</button>
                </form></body></html>
                """.formatted(error, csrfField);
    }
}
