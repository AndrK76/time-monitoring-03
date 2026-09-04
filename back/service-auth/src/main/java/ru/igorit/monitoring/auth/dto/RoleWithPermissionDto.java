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
public class RoleWithPermissionDto {
    private String id;
    private String name;
    private String description;
    private String[] permissions;
    private boolean special;
}