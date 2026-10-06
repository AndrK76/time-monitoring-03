package ru.igorit.monitoring.macroscop.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class MSCPMotionDetectorSettings {
    private Boolean generationOfEventMotionStartAndEndEnabled;
    private List<MSCPMotionDetectorZone> zones;
}