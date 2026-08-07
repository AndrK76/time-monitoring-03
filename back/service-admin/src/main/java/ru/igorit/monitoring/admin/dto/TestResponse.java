// service-admin/src/main/java/ru/igorit/monitoring/admin/dto/TestResponse.java
package ru.igorit.monitoring.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TestResponse {
    private String message;
    private String username;
    private String userId;
    private String roles;
    private String permissions;
    private LocalDateTime timestamp;
    private boolean success;
}