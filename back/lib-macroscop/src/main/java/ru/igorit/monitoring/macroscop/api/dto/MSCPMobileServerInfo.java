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
public class MSCPMobileServerInfo {
    private Boolean isEnabled;
    private Boolean isProxyEnabled;
    private Boolean isMobilePushEnabled;
    private Integer port;
    private Boolean usePFrames;
    private Integer fpsLimit;
    private String lowResolution;
    private String middleResolution;
    private String highResolution;
    private List<MSCPResolution> resolutions;
}