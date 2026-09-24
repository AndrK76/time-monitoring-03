package ru.igorit.monitoring.macroscop.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class MSCPServer {
    private String id;
    private String name;
    private String url;
    private String primaryIp;
    private String primaryPort;
    private String primarySslPort;
    private String secondaryIp;
    private String secondaryPort;
    private String secondarySslPort;
}