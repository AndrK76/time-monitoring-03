package ru.igorit.monitoring.web.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserResponseDto {

    private String id;
    private String username;
    private String email;
    private String firstName;
    private String lastName;
    private String displayName;
    private String avatarUrl;
    private boolean active;
    private boolean approved;
    private boolean emailVerified;
    private List<String> roles;
    private List<String> permissions;
    private boolean anonymous;

}