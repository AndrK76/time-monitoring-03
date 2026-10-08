package ru.igorit.monitoring.admin.service;

import ru.igorit.monitoring.common.dto.common.BinaryContent;
import ru.igorit.monitoring.lib.dto.macroscop.*;
import ru.igorit.monitoring.lib.persistence.entity.macroscop.MacroscopActivityEventType;

import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;

public interface MacroscopManageService {
    MacroscopEvtAgentConfigDto getEvtConfig(String agentId);

    MacroscopEvtAgentConfigDto updateEvtConfig(String agentId, MacroscopEvtAgentConfigDto dto);

    MacroscopEvtAgentConfigDto bindEvtConfig(String agentId, String configId);

    MacroscopEvtAgentConfigDto unbindEvtConfig(String agentId);

    MacroscopImgAgentConfigDto getImgConfig(String agentId);

    MacroscopImgAgentConfigDto updateImgConfig(String agentId, MacroscopImgAgentConfigDto dto);

    MacroscopImgAgentConfigDto bindImgConfig(String agentId, String configId);

    MacroscopImgAgentConfigDto unbindImgConfig(String agentId);

    List<MacroscopImgPlaceListDto> getImgPlacesForAgent(String agentId, boolean showDeleted);

    MacroscopImgPlaceDto addImgPlaceByAgent(String agentId, MacroscopImgPlaceDto dto);

    List<MacroscopChannelListDto> getActualChannelsForAgent(String agentId);

    MacroscopImgPlaceDto getImgPlace(String id);

    MacroscopImgPlaceDto updateImgPlace(String id, MacroscopImgPlaceDto dto);

    void markPlaceAsDeleted(String id);

    MacroscopImgPlaceDto restoreDeletedPlace(String id);

    List<MacroscopAgentConfigListDto> getConfigs();

    MacroscopAgentConfigDto getConfig(String configId);

    MacroscopAgentConfigDto newConfig();

    MacroscopAgentConfigDto updateConfig(String configId, MacroscopAgentConfigDto dto);

    void deleteConfig(String configId);

    List<MacroscopChannelDto> getChannelsForConfig(String configId);

    List<MacroscopChannelDto> updateChannelsForConfig(
            String configId, List<MacroscopChannelDto> dtoList);

    List<MacroscopEventTypeDto> getEventTypes();

    List<MacroscopEventTypeDto> updateEventTypes(List<MacroscopEventTypeDto> newVals);

    List<MacroscopArchiveModeDto> getArchiveModes();

    List<MacroscopActivityEventTypeDto> getActivityEventTypes();

    List<MacroscopEvtAgentModeDto> getEvtAgentModes();

    MacroscopDataResponse<MacroscopServerInfoDto> getServerInfo(String configId);

    MacroscopDataResponse<MacroscopServerInfoDto> getServerInfoByCreds(
            MacroscopServerCredentials creds);

    MacroscopDataResponse<List<MacroscopChannelDto>> getAllowedChannels(String configId);

    MacroscopDataResponse<BinaryContent> getCurrentScreenShotOnChannel(
            String configId, String channelId
    );

    MacroscopDataResponse<BinaryContent> getLastArchiveScreenShotOnChannel(
            String configId, String channelId
    );

    MacroscopDataResponse<List<MacroscopEventTypeDto>> getMacroscopEventTypes(String configId);


    MacroscopDataResponse<List<MacroscopEvtPlaceDto>> getEvtPlacesInDetectorModeForConfigAndChannel(
            String agentId, String channelId
    );

    MacroscopDataResponse<MacroscopEvtActionPlacesResponseDto> getEvtPlacesInActionModeForChannel(
            String agentId, String channelId, ZonedDateTime before
    );


}
