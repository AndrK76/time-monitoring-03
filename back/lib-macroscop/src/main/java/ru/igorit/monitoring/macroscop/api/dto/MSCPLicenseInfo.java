package ru.igorit.monitoring.macroscop.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MSCPLicenseInfo {

    private String productType;
    private Boolean isTimeLimited;
    private String timeLimit;
    private String language;
    private Boolean isMaxClientsLimited;
    private Integer maxClients;
    private Boolean videoAnalystServer;
    private Boolean isNetworkLicenseEnabled;
    private Boolean isRestConfigurationEnabled;
    private Boolean isActiveDirectoryAuthEnabled;
    private Boolean isJuniorAdminEnabled;
    private Boolean isMessengerEnabled;
    private Boolean isVideoWallEnabled;
    private Boolean isDuplicateArchiveEnabled;
    private Boolean isArchiveThinningEnabled;
    private Boolean isMonitoringEnabled;
    private Boolean isPriorityPtzEnabled;
    private Boolean isAlarmOnPlansEnabled;
    private Boolean isArchiveEpisodesFeatureEnabled;
    private Boolean isLongTermDatabaseFeatureEnabled;
    private Boolean isEchdIntegrationEnabled;

    private MSCPLicenseInfoChannelStat nonRegistratorChannels;
    private MSCPLicenseInfoChannelStat registratorChannels;
    private MSCPLicenseInfoChannelStat reservedChannels;
    private MSCPLicenseInfoChannelStat soundChannels;
    private MSCPLicenseInfoChannelStat ptzChannels;
    private MSCPLicenseInfoChannelStat posTerminalChannels;
    private MSCPLicenseInfoChannelStat faceDetectorChannels;
    private MSCPLicenseInfoChannelStat interactiveSearchChannels;
    private MSCPLicenseInfoChannelStat plateRecognitionChannels;
    private MSCPLicenseInfoChannelStat peopleCntChannels;
    private MSCPLicenseInfoChannelStat trackingChannels;
    private MSCPLicenseInfoChannelStat heatMapChannels;
    private MSCPLicenseInfoChannelStat queueCounterChannels;
    private MSCPLicenseInfoChannelStat abandonedObjectChannels;
    private MSCPLicenseInfoChannelStat crowdCountingChannels;
    private MSCPLicenseInfoChannelStat fireAndSmokeChannels;
    private MSCPLicenseInfoChannelStat personalControlChannels;
    private MSCPLicenseInfoChannelStat loudSoundChannels;
    private MSCPLicenseInfoChannelStat objectCounterModuleChannels;
    private MSCPLicenseInfoChannelStat emergencyVehicleDetectionModuleChannels;
    private MSCPLicenseInfoChannelStat fallenPeopleDetectionModuleChannels;
    private MSCPLicenseInfoChannelStat ourPlatesModuleChannels;
    private MSCPLicenseInfoChannelStat autoMarshalChannels;
    private MSCPLicenseInfoChannelStat fishEyeChannels;
    private MSCPLicenseInfoChannelStat peopleCnt3DChannels;
    private MSCPLicenseInfoChannelStat hardHatDetectionChannels;
    private MSCPLicenseInfoChannelStat shelfFullnessDetectors;
    private MSCPLicenseInfoChannelStat lightFaceRecognitionChannels;
    private MSCPLicenseInfoChannelStat completeFaceRecognitionChannels;
    private MSCPLicenseInfoChannelStat visitorStatisticsFaceRecognitionChannels;
    private MSCPLicenseInfoChannelStat cameraBuiltInAnalystChannels;
}