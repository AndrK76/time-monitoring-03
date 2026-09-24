package ru.igorit.monitoring.macroscop.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class MSCPRtspServerInfo {
    private Boolean isEnabled;
    private Integer tcpPort;
    private Boolean isMjpegEnabled;
}