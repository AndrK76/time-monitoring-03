package ru.igorit.monitoring.lib.dto.crm;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CrmAgentTypeDto {
    private String value;
    private String name;
    private String description;
}
