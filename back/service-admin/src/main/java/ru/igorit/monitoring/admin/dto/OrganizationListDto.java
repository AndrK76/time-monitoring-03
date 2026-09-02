package ru.igorit.monitoring.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrganizationListDto {
    private String id;
    private String shortName;
    private String fullName;
}
