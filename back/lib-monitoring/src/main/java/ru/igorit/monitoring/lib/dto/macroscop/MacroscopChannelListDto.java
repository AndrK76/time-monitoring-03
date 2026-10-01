package ru.igorit.monitoring.lib.dto.macroscop;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.ZoneOffset;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MacroscopChannelListDto {
    private String id;
    private String macroscopId;
    private String name;
    private String device;
    private boolean enabled;
    private boolean exists;
    private boolean used;
}
