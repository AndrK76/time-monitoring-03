package ru.igorit.monitoring.lib.dto.macroscop;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MacroscopAgentConfigDto {
    private String id;
    @NotBlank
    private String name;
    private String serverAddress;
    @NotNull
    private MacroscopCredentialsDto credentials;
}
