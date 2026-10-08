package ru.igorit.monitoring.lib.dto.macroscop;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MacroscopEvtPlaceListDto {
    private String id;
    private String name;
    private String channelId;
    private String internalName;
    private String internalId;
    private String evtMode;
    private boolean used;
    private boolean present;
    private boolean deleted;
}
