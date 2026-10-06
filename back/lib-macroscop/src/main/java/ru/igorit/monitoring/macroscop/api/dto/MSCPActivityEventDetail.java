package ru.igorit.monitoring.macroscop.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class MSCPActivityEventDetail {
    private Double left;
    private Double top;
    private Double width;
    private Double height;
    private String zoneId;
    private String eventName;
}