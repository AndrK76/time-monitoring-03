package ru.igorit.monitoring.security.aspect;

import lombok.RequiredArgsConstructor;
import ru.igorit.monitoring.common.dto.command.CommandMessageDto;
import ru.igorit.monitoring.common.dto.command.auth.SecurityContextDto;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import ru.igorit.monitoring.security.mapper.SecurityContextMapper;

@Aspect
@Component
@Slf4j
@RequiredArgsConstructor
public class SecurityContextAspect {
    //TODO: Тут скорее если нужно будет нужно будет что-то типа класса команды сделать

    private final SecurityContextMapper mapper;

    @Around("@annotation(ru.igorit.monitoring.security.annotation.WithSecurityContext)")
    public Object restoreSecurityContext(ProceedingJoinPoint joinPoint) throws Throwable {
        CommandMessageDto commandMessageDto = findCommandMessage(joinPoint.getArgs());

        if (commandMessageDto == null) {
            log.warn("No CommandMessage found in method: {}", joinPoint.getSignature());
            return joinPoint.proceed();
        }

        SecurityContextDto securityContextDto = commandMessageDto.getSecurityContext();
        if (securityContextDto == null) {
            log.warn("No SecurityContext in CommandMessage for method: {}", joinPoint.getSignature());
            return joinPoint.proceed();
        }

        SecurityContext originalContext = SecurityContextHolder.getContext();

        try {
            SecurityContext restoredContext = mapper.toSecurityContext(securityContextDto);
            SecurityContextHolder.setContext(restoredContext);

            log.debug("Restored SecurityContext for user: {}",
                    restoredContext.getAuthentication() != null ?
                            restoredContext.getAuthentication().getName() : "anonymous");

            return joinPoint.proceed();

        } finally {
            SecurityContextHolder.setContext(originalContext);
        }
    }

    private CommandMessageDto findCommandMessage(Object[] args) {
        for (Object arg : args) {
            if (arg instanceof CommandMessageDto) {
                return (CommandMessageDto) arg;
            }
        }
        return null;
    }
}