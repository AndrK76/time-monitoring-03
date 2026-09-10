package ru.igorit.monitoring.lib.dto.yclients;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class YClientsAgentConfigDto {
    private String id;
    private YClientCredentialsDto credentials;
}
