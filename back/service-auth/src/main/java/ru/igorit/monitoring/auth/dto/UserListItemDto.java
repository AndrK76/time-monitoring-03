package ru.igorit.monitoring.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserListItemDto {
    private String id;
    private String username;
    private String displayName;
    private boolean active;
    private boolean approved;
    private List<String> roles;
}