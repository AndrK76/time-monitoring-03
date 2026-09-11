package ru.igorit.monitoring.lib.dto.yclients;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class YClientsOrganizationDto {
    private String id;
    private List<String> places;
    private String agentId;
    private Long ycId;
    private String name;
    private String timezone;
}
