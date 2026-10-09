package ru.igorit.monitoring.admin.service;

import ru.igorit.monitoring.common.dto.common.BinaryContent;
import ru.igorit.monitoring.lib.dto.macroscop.*;

import java.time.ZonedDateTime;
import java.util.List;

public interface MacroscopManageService {
    //evt-configs
    MacroscopEvtAgentConfigDto getEvtConfig(String agentId);
    MacroscopEvtAgentConfigDto updateEvtConfig(String agentId, MacroscopEvtAgentConfigDto dto);
    MacroscopEvtAgentConfigDto bindEvtConfig(String agentId, String configId);
    MacroscopEvtAgentConfigDto unbindEvtConfig(String agentId);

    //img-configs
    MacroscopImgAgentConfigDto getImgConfig(String agentId);
    MacroscopImgAgentConfigDto updateImgConfig(String agentId, MacroscopImgAgentConfigDto dto);
    MacroscopImgAgentConfigDto bindImgConfig(String agentId, String configId);
    MacroscopImgAgentConfigDto unbindImgConfig(String agentId);

    //evt-places (/evt-agents/{}/evt-places)
    List<MacroscopEvtPlaceListDto> getEvtPlacesForAgent(String agentId, boolean showDeleted);
    MacroscopEvtPlaceDto addEvtPlaceByAgent(String agentId, MacroscopEvtPlaceDto dto);
    List<MacroscopChannelListDto> getActualChannelsForEvtAgent(String agentId);
    MacroscopEvtPlaceDto getEvtPlace(String id);
    MacroscopEvtPlaceDto updateEvtPlace(String id, MacroscopEvtPlaceDto dto);
    void markEvtPlaceAsDeleted(String id);
    MacroscopEvtPlaceDto restoreDeletedEvtPlace(String id);
    void applyZoneChangeAt(String placeId, MacroscopZoneInfoDto newInfo, ZonedDateTime at);

    //img-places (/img-agents/{}/img-places)
    List<MacroscopImgPlaceListDto> getImgPlacesForAgent(String agentId, boolean showDeleted);
    MacroscopImgPlaceDto addImgPlaceByAgent(String agentId, MacroscopImgPlaceDto dto);
    List<MacroscopChannelListDto> getActualChannelsForImgAgent(String agentId);
    MacroscopImgPlaceDto getImgPlace(String id);
    MacroscopImgPlaceDto updateImgPlace(String id, MacroscopImgPlaceDto dto);
    void markImgPlaceAsDeleted(String id);
    MacroscopImgPlaceDto restoreDeletedImgPlace(String id);

    //configs
    List<MacroscopAgentConfigListDto> getConfigs();
    MacroscopAgentConfigDto getConfig(String configId);
    MacroscopAgentConfigDto newConfig();
    MacroscopAgentConfigDto updateConfig(String configId, MacroscopAgentConfigDto dto);
    void deleteConfig(String configId);
    List<MacroscopChannelDto> getChannelsForConfig(String configId);
    List<MacroscopChannelDto> updateChannelsForConfig(
            String configId, List<MacroscopChannelDto> dtoList);

    //event-types
    List<MacroscopEventTypeDto> getEventTypes();
    List<MacroscopEventTypeDto> updateEventTypes(List<MacroscopEventTypeDto> newVals);


    //misc/archive-modes
    List<MacroscopArchiveModeDto> getArchiveModes();
    //misc/activity-event-types
    List<MacroscopActivityEventTypeDto> getActivityEventTypes();
    //misc/evt-agent-modes
    List<MacroscopEvtAgentModeDto> getEvtAgentModes();
    //misc/server-info
    MacroscopDataResponse<MacroscopServerInfoDto> getServerInfo(String configId);
    MacroscopDataResponse<MacroscopServerInfoDto> getServerInfoByCreds(
            MacroscopServerCredentials creds);
    //misc/configs/{}/channels
    MacroscopDataResponse<List<MacroscopChannelDto>> getAllowedChannels(String configId);
    MacroscopDataResponse<BinaryContent> getCurrentScreenShotOnChannel(
            String configId, String channelId
    );
    MacroscopDataResponse<BinaryContent> getLastArchiveScreenShotOnChannel(
            String configId, String channelId
    );
    //misc/configs/{id}/event-types
    MacroscopDataResponse<List<MacroscopEventTypeDto>> getMacroscopEventTypes(String configId);

    //misc/evt-configs/{}/channels/{}/places
    MacroscopDataResponse<List<MacroscopEvtPlaceDto>> getEvtPlacesInDetectorModeForConfigAndChannel(
            String agentId, String channelId
    );
    MacroscopDataResponse<MacroscopEvtActionPlacesResponseDto> getEvtPlacesInActionModeForChannel(
            String agentId, String channelId, ZonedDateTime before
    );


}
