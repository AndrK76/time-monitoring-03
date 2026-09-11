package ru.igorit.monitoring.lib.dto.yclients;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class YClientsTokenRequest {
    @NotBlank
    private String partnerToken;
    @NotBlank
    private String login;
    @NotBlank
    private String password;
}
