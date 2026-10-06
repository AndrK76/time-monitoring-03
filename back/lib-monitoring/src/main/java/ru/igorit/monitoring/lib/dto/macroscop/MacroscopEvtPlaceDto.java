package ru.igorit.monitoring.lib.dto.macroscop;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MacroscopEvtPlaceDto {
    private String id;
    private String type;
    private String name;
    private String internalName;
    private String internalId;
    private String evtMode;
    private String channelId;
    private MacroscopZoneInfoDto zoneInfo;
    private boolean used;
    private boolean actual;
    private boolean present;
    private boolean deleted;
}
