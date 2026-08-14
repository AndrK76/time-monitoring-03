package ru.igorit.monitoring.common.dto.command.auth;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserInfoUpdatedEventCommandDto implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    private String userId;
    private String username;
    private String email;
    private String firstName;
    private String lastName;
    private String displayName;
    private boolean active;
    private boolean approved;


    private LocalDateTime updatedAt;
    private String updatedBy;
    private boolean fullUpdate;
    private String[] roles;
}