// service-auth/src/main/java/ru/igorit/monitoring/auth/controller/AdminController.java
package ru.igorit.monitoring.auth.controller;

import ru.igorit.monitoring.auth.dto.LoginRequestDto;
import ru.igorit.monitoring.auth.service.AdminService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
@Slf4j
public class AdminController {

    private final AdminService adminService;

    /**
     * Временный endpoint для обновления пароля пользователя
     * ДОСТУПЕН ВСЕМ! Удалить после исправления миграций
     */
    @PostMapping("/update-password")
    public ResponseEntity<Map<String, String>> updatePassword(@RequestBody LoginRequestDto request) {
        log.info("Updating password for user: {}", request.getUsername());
        String result = adminService.updatePassword(request.getUsername(), request.getPassword());
        return ResponseEntity.ok(Map.of(
                "message", result,
                "username", request.getUsername()
        ));
    }
}