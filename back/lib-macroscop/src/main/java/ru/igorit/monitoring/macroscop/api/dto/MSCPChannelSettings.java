package ru.igorit.monitoring.macroscop.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class MSCPChannelSettings {
    private String id;
    private String name;
    private Boolean disabled;
    private MSCPChannelAnalyticSettings analyzeSettings;
}