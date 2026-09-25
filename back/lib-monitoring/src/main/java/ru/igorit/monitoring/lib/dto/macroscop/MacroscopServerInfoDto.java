package ru.igorit.monitoring.lib.dto.macroscop;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.ZoneOffset;
import java.time.ZonedDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MacroscopServerInfoDto {
    private String     id;
    private String version;
    private ZonedDateTime responseDate;
    private ZoneOffset tz;
    private boolean useTz;
}
