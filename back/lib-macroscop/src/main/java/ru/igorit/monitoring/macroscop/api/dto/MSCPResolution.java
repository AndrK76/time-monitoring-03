package ru.igorit.monitoring.macroscop.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class MSCPResolution {
    private Integer width;
    private Integer height;
    private Boolean isEnabled;
    private Integer fpsLimit;
    private Boolean usePFrames;
    private String type;
}