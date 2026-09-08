package ru.igorit.monitoring.web.adviser;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResponseStatusException.class)
    public ProblemDetail handleResponseStatusException(ResponseStatusException ex) {
        ProblemDetail problemDetail = ProblemDetail.forStatusAndDetail(
                ex.getStatusCode(),
                ex.getReason()
        );
        problemDetail.setProperty("timestamp", Instant.now());
        if (problemDetail.getInstance() != null) {
            problemDetail.setProperty("path", problemDetail.getInstance());
        }
        return problemDetail;
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ProblemDetail handleAccessDenied(AccessDeniedException ex) {
        ProblemDetail problemDetail = ProblemDetail.forStatusAndDetail(
                HttpStatus.FORBIDDEN,
                ex.getMessage()
        );
        problemDetail.setProperty("timestamp", Instant.now());
        if (problemDetail.getInstance() != null) {
            problemDetail.setProperty("path", problemDetail.getInstance());
        }
        return problemDetail;
    }

    @ExceptionHandler(AuthenticationException.class)
    public ProblemDetail handleAuthentication(AuthenticationException ex) {
        ProblemDetail problemDetail = ProblemDetail.forStatusAndDetail(
                HttpStatus.UNAUTHORIZED,
                "Необходима аутентификация"
        );
        problemDetail.setProperty("timestamp", Instant.now());
        if (problemDetail.getInstance() != null) {
            problemDetail.setProperty("path", problemDetail.getInstance());
        }
        return problemDetail;
    }


    @ExceptionHandler(Exception.class)
    public ProblemDetail handleGenericException(Exception ex) {
        ProblemDetail problemDetail;
        if (ex instanceof ErrorResponse er) {
            problemDetail = ProblemDetail.forStatusAndDetail(
                    er.getStatusCode(),
                    er.getBody().getDetail()
            );
        } else {
            problemDetail = ProblemDetail.forStatusAndDetail(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    ex.getMessage()
            );
        }
        problemDetail.setProperty("timestamp", Instant.now());
        if (problemDetail.getInstance() != null) {
            problemDetail.setProperty("path", problemDetail.getInstance());
        }
        return problemDetail;
    }
}