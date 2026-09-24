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
public class MSCPConfigResponse {
    private String id;
    private Integer revNum;
    private String timestamp;
    private Integer xmlProtocolVersion;
    private String serverVersion;
    private String productType;
    private List<MSCPServer> servers;
    private List<MSCPChannel> channels;
    private MSCPMobileServerInfo mobileServerInfo;
    private MSCPRtspServerInfo rtspServerInfo;
    private Boolean useTimeZones;
}