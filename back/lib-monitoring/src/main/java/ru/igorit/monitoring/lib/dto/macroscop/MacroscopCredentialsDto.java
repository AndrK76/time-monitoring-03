package ru.igorit.monitoring.lib.dto.macroscop;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MacroscopCredentialsDto {
    private String login;
    private String password;
}
