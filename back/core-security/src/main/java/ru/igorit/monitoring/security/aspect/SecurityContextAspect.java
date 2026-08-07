package ru.igorit.monitoring.security.aspect;

import ru.igorit.monitoring.common.dto.CommandMessage;
import ru.igorit.monitoring.common.dto.SecurityContextDto;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Aspect
@Component
@Slf4j
public class SecurityContextAspect {

    @Around("@annotation(ru.igorit.monitoring.security.annotation.WithSecurityContext)")
    public Object restoreSecurityContext(ProceedingJoinPoint joinPoint) throws Throwable {
        CommandMessage commandMessage = findCommandMessage(joinPoint.getArgs());

        if (commandMessage == null) {
            log.warn("No CommandMessage found in method: {}", joinPoint.getSignature());
            return joinPoint.proceed();
        }

        SecurityContextDto securityContextDto = commandMessage.getSecurityContext();
        if (securityContextDto == null) {
            log.warn("No SecurityContext in CommandMessage for method: {}", joinPoint.getSignature());
            return joinPoint.proceed();
        }

        SecurityContext originalContext = SecurityContextHolder.getContext();

        try {
            SecurityContext restoredContext = securityContextDto.toSecurityContext();
            SecurityContextHolder.setContext(restoredContext);

            log.debug("Restored SecurityContext for user: {}",
                    restoredContext.getAuthentication() != null ?
                            restoredContext.getAuthentication().getName() : "anonymous");

            return joinPoint.proceed();

        } finally {
            SecurityContextHolder.setContext(originalContext);
        }
    }

    private CommandMessage findCommandMessage(Object[] args) {
        for (Object arg : args) {
            if (arg instanceof CommandMessage) {
                return (CommandMessage) arg;
            }
        }
        return null;
    }
}