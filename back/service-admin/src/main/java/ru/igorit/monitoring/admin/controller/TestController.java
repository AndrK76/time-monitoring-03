// service-admin/src/main/java/ru/igorit/monitoring/admin/controller/TestController.java
package ru.igorit.monitoring.admin.controller;

import ru.igorit.monitoring.admin.dto.TestResponse;
import ru.igorit.monitoring.admin.service.TestService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/test")
@RequiredArgsConstructor
@Slf4j
public class TestController {

    private final TestService testService;

    @GetMapping("/public")
    public ResponseEntity<TestResponse> publicEndpoint() {
        return ResponseEntity.ok(TestResponse.builder()
                .message("Public endpoint - доступен всем")
                .success(true)
                .timestamp(java.time.LocalDateTime.now())
                .build());
    }

    @GetMapping("/authenticated")
    public ResponseEntity<TestResponse> authenticatedEndpoint() {
        TestResponse response = testService.getUserInfo("Authenticated");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/deviation/approve")
    @PreAuthorize("hasAuthority('DEVIATION_APPROVE')")
    public ResponseEntity<TestResponse> approveDeviation() {
        TestResponse response = testService.getUserInfo("Отклонение подтверждено");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/admin/system")
    @PreAuthorize("hasRole('SYSTEM_ADMIN')")
    public ResponseEntity<TestResponse> systemAdminOnly() {
        TestResponse response = testService.getUserInfo("Доступ к системному администрированию");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/admin/org")
    @PreAuthorize("hasRole('ORG_ADMIN')")
    public ResponseEntity<TestResponse> orgAdminOnly() {
        TestResponse response = testService.getUserInfo("Доступ к администрированию организации");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/dispatcher")
    @PreAuthorize("hasRole('DISPATCHER')")
    public ResponseEntity<TestResponse> dispatcherOnly() {
        TestResponse response = testService.getUserInfo("Доступ диспетчера");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/dispatcher/approve")
    @PreAuthorize("hasRole('DISPATCHER') and hasAuthority('DEVIATION_APPROVE')")
    public ResponseEntity<TestResponse> dispatcherWithApprove() {
        TestResponse response = testService.getUserInfo("Диспетчер с правом подтверждения");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/deviation/check")
    public ResponseEntity<TestResponse> checkDeviationPermission() {
        TestResponse response = testService.checkDeviationPermission();
        return ResponseEntity.ok(response);
    }

    @GetMapping("/my-permissions")
    public ResponseEntity<TestResponse> getMyPermissions() {
        TestResponse response = testService.getUserInfo("Ваши права");
        return ResponseEntity.ok(response);
    }
}