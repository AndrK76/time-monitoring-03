package ru.igorit.monitoring.lib.dto.macroscop;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.ZoneOffset;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MacroscopChannelDto {
    private String id;
    private String macroscopId;
    private String name;
    private String device;
    private boolean enabled;
    private boolean exists;
    private boolean used;
    private boolean archivingEnabled;
    private boolean archiveAllowed;
    private boolean realtimeAllowed;
    private boolean soundAllowed;
    private String archiveMode;
    private ZoneOffset tz;
}
