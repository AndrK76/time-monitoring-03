package ru.igorit.monitoring.macroscop.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class MSCPActivityEvent {
    private String eventId;
    private String eventDescription;
    private Integer eventCategory;
    private Integer eventInitiatorType;
    private String eventComment;
    private String channelId;
    private String channelName;
    private OffsetDateTime timestamp;
    private MSCPActivityEventDetail event;
}