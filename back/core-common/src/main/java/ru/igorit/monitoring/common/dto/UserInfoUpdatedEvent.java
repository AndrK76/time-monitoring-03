package ru.igorit.monitoring.common.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserInfoUpdatedEvent implements Serializable {

    private static final long serialVersionUID = 1L;

    private String userId;
    private String username;
    private String email;
    private String firstName;
    private String lastName;
    private String displayName;
    private LocalDateTime updatedAt;
    private String updatedBy;
    private boolean fullUpdate; // true — админ обновил все поля, false — только личные
}