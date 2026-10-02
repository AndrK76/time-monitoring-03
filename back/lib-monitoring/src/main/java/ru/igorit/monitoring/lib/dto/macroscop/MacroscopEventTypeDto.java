package ru.igorit.monitoring.lib.dto.macroscop;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MacroscopEventTypeDto {
    @NotBlank
    private String id;
    private String name;
    private String activityTypeId;
}
