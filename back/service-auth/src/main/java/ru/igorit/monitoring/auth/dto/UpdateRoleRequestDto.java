package ru.igorit.monitoring.auth.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateRoleRequestDto {

    @NotBlank(message = "name is required")
    private String name;

    @NotBlank(message = "Description is required")
    private String description;

    private List<String> permissions = new ArrayList<>();
}