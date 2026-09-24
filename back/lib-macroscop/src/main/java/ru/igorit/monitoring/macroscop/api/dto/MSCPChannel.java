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
public class MSCPChannel {
    private String id;
    private String name;
    private String description;
    private String deviceInfo;
    private String attachedToServer;
    private Boolean isDisabled;
    private Boolean isSoundOn;
    private Boolean isArchivingEnabled;
    private Boolean isSoundArchivingEnabled;
    private Boolean allowedRealtime;
    private Boolean allowedArchive;
    private Boolean isPtzOn;
    private Boolean isTransmitSoundOn;
    private String archiveMode;
    private List<MSCPStream> streams;
    private String archiveStreamType;
    private String archiveVideoFormat;
    private String archiveRotationMode;
    private Boolean isFaceRecOn;
    private Boolean isPeopleCountingOn;
    private Boolean isObjectCountingOn;
    private Double timeZoneOffset;
    private Boolean isPlateRecognitionOn;
}