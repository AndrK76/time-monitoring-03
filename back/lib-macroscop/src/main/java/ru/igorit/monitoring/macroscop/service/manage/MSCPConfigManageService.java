package ru.igorit.monitoring.macroscop.service.manage;

import com.fasterxml.jackson.core.type.TypeReference;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Service;
import ru.igorit.monitoring.common.dto.common.BinaryContent;
import ru.igorit.monitoring.lib.dto.macroscop.*;
import ru.igorit.monitoring.lib.enums.EvtAgentType;
import ru.igorit.monitoring.lib.persistence.entity.macroscop.MacroscopArchiveMode;
import ru.igorit.monitoring.lib.persistence.entity.macroscop.MacroscopEvtAgentMode;
import ru.igorit.monitoring.macroscop.api.config.MacroscopApiProperties;
import ru.igorit.monitoring.macroscop.api.dto.*;
import ru.igorit.monitoring.macroscop.api.service.MacroscopApiClient;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

import static java.lang.Boolean.FALSE;
import static java.lang.Boolean.TRUE;
import static ru.igorit.monitoring.macroscop.api.utils.MacroscopUtils.*;

@Service
@Log4j2
@RequiredArgsConstructor
public class MSCPConfigManageService {
    private final MacroscopApiProperties apiProperties;
    private final MacroscopApiClient apiClient;

    public MacroscopDataResponse<MacroscopServerInfoDto> getServerInfo(MacroscopServerCredentials creds) {
        var response = _getServerInfo(creds);
        var licResponse = _getLicenseInfo(creds);
        return _parseServerInfoResponse(response, licResponse);
    }

    private MacroscopDataResponse<MSCPConfigResponse> _getServerInfo(MacroscopServerCredentials creds) {
        return apiClient.exchange(
                MacroscopApiClient.Client.main,
                creds.address() + apiProperties.getServerConfigApi(),
                HttpMethod.GET,
                Map.of("login", creds.login(), "password", creds.passwordHash(), "responsetype", "json"),
                null,
                null,
                new TypeReference<MSCPConfigResponse>() {
                }
        ).orElse(apiClient.emptyErrorResponse());
    }

    private MacroscopDataResponse<MSCPLicenseInfo> _getLicenseInfo(MacroscopServerCredentials creds) {
        return apiClient.exchange(
                MacroscopApiClient.Client.main,
                creds.address() + apiProperties.getWebApi() + apiProperties.getLicenseApi(),
                HttpMethod.GET,
                null,
                new MacroscopApiClient.AuthData(creds.login(), creds.passwordHash()),
                null,
                new TypeReference<MSCPLicenseInfo>() {
                }
        ).orElse(apiClient.emptyErrorResponse());
    }

    private MacroscopDataResponse<MacroscopServerInfoDto> _parseServerInfoResponse(
            MacroscopDataResponse<MSCPConfigResponse> response,
            MacroscopDataResponse<MSCPLicenseInfo> licResponse) {
        var ret = new MacroscopDataResponse<MacroscopServerInfoDto>(response);
        if (response.isSuccess() && response.getData() != null) {
            var zoneOffset = extractZoneOffset(response.getData().getChannels());
            var displayZone = (zoneOffset != null) ? zoneOffset : ZoneOffset.UTC;
            var serverTime = parseTimestamp(response.getData().getTimestamp());
            var responseTime = serverTime.atZone(displayZone);
            ret.setData(MacroscopServerInfoDto.builder()
                    .id(response.getData().getId())
                    .version(response.getData().getServerVersion())
                    .responseDate(responseTime)
                    .tz(zoneOffset)
                    .useTz(response.getData().getUseTimeZones())
                    .build());
            if (licResponse.isSuccess() && licResponse.getData() != null) {
                var licData = licResponse.getData();
                var data = ret.getData();
                data.setProduct(licData.getProductType() == null ? null : licData.getProductType().trim());
                data.setLicenseEnd(licData.getTimeLimit() == null ? null
                        : parseTimestamp(licData.getTimeLimit()).atZone(displayZone));
                int analyticAvailable =
                        licData.getPersonalControlChannels() == null ? 0 : licData.getPersonalControlChannels().getTotal();
                int analyticUsed =
                        licData.getPersonalControlChannels() == null ? 0 : licData.getPersonalControlChannels().getUsed();
                data.setPcAnalyticInfo(String.format("%d из %d", analyticAvailable, analyticUsed));
            }
        } else if (response.isSuccess()) {
            ret.setSuccess(false);
            ret.setErrorMessage("Empty response data");
        }
        return ret;
    }

    public MacroscopDataResponse<List<MacroscopChannelDto>> getAllowedChannels(MacroscopServerCredentials creds) {
        var response = _getServerInfo(creds);
        return _parseChannelsResponse(response);
    }

    private MacroscopDataResponse<List<MacroscopChannelDto>> _parseChannelsResponse(MacroscopDataResponse<MSCPConfigResponse> response) {
        var ret = new MacroscopDataResponse<List<MacroscopChannelDto>>(response);
        if (response.isSuccess() && response.getData() != null && response.getData().getChannels() != null) {
            ret.setData(
                    response.getData().getChannels().stream()
                            .map(r -> {
                                var zoneOffset = hoursToZoneOffset(r.getTimeZoneOffset());
                                var streams = (r.getStreams() == null)
                                        ? List.<MacroscopChannelStreamDto>of()
                                        : r.getStreams().stream()
                                        .filter(Objects::nonNull)
                                        .map(s -> MacroscopChannelStreamDto.builder()
                                                .type(s.getStreamType())
                                                .format(s.getStreamFormat())
                                                .build())
                                        .toList();
                                return MacroscopChannelDto.builder()
                                        .macroscopId(r.getId())
                                        .name(r.getName())
                                        .device(r.getDeviceInfo())
                                        .enabled(!Boolean.TRUE.equals(r.getIsDisabled()))
                                        .exists(true)
                                        .used(true)
                                        .archivingEnabled(Boolean.TRUE.equals(r.getIsArchivingEnabled()))
                                        .archiveAllowed(Boolean.TRUE.equals(r.getAllowedArchive()))
                                        .realtimeAllowed(Boolean.TRUE.equals(r.getAllowedRealtime()))
                                        .soundAllowed(Boolean.TRUE.equals(r.getIsSoundOn()))
                                        .archiveMode(MacroscopArchiveMode.idByMacroscopId(r.getArchiveMode()))
                                        .tz(zoneOffset)
                                        .streams(streams)
                                        .build();
                            }).toList()
            );
        } else if (response.isSuccess()) {
            ret.setSuccess(false);
            ret.setErrorMessage("Empty channel list");
        }
        return ret;
    }

    public MacroscopDataResponse<List<MacroscopEventTypeDto>> getEventTypes(MacroscopServerCredentials creds) {
        var response = _getEventTypes(creds);
        return _parseEventTypes(response);
    }

    private MacroscopDataResponse<List<MSCPEventType>> _getEventTypes(MacroscopServerCredentials creds) {
        return apiClient.exchange(
                MacroscopApiClient.Client.main,
                creds.address() + apiProperties.getEventTypesApi(),
                HttpMethod.GET,
                Map.of("login", creds.login(), "password", creds.passwordHash(), "responsetype", "json"),
                null,
                null,
                new TypeReference<List<MSCPEventType>>() {
                }
        ).orElse(apiClient.emptyErrorResponse());
    }

    private MacroscopDataResponse<List<MacroscopEventTypeDto>> _parseEventTypes(
            MacroscopDataResponse<List<MSCPEventType>> response) {
        var ret = new MacroscopDataResponse<List<MacroscopEventTypeDto>>(response);
        if (response.isSuccess() && response.getData() != null) {
            ret.setData(
                    response.getData().stream()
                            .map(r -> MacroscopEventTypeDto.builder()
                                    .id(r.getId())
                                    .name(r.getName())
                                    .build()).toList()
            );
        } else if (response.isSuccess()) {
            ret.setSuccess(false);
            ret.setErrorMessage("Empty event types list");
        }
        return ret;
    }


    public MacroscopDataResponse<BinaryContent> getCurrentScreenShotOnChannel(
            MacroscopServerCredentials creds,
            String channelId,
            String streamType
    ) {
        return apiClient.exchangeBinary(
                MacroscopApiClient.Client.img,
                creds.address() + apiProperties.getSiteOperationsApi(),
                HttpMethod.GET,
                Map.of(
                        "login", creds.login(),
                        "password", creds.passwordHash(),
                        "channelId", channelId,
                        "resolutionx", String.valueOf(apiProperties.getBigResolutionX()),
                        "streamtype", streamType
                ),
                null,
                null
        ).orElse(apiClient.emptyErrorResponse());
    }

    public MacroscopDataResponse<BinaryContent> getLastArchiveScreenShotOnChannel(
            MacroscopServerCredentials creds,
            String channelId
    ) {
        return apiClient.exchangeBinary(
                MacroscopApiClient.Client.img,
                creds.address() + apiProperties.getSiteOperationsApi(),
                HttpMethod.GET,
                Map.of(
                        "login", creds.login(),
                        "password", creds.passwordHash(),
                        "channelId", channelId,
                        "resolutionx", String.valueOf(apiProperties.getBigResolutionX()),
                        "mode", "archive",
                        "starttime", toMacroscopParamTime(ZonedDateTime.now())
                ),
                null,
                null
        ).orElse(apiClient.emptyErrorResponse());
    }

    public MacroscopDataResponse<List<MacroscopEvtPlaceDto>> getPlacesFromDetectorZoneFromChannelConfig(
            MacroscopServerCredentials creds, String channelId) {
        var response = _getChannelSettings(creds, channelId);
        return _parsePlacesFromChannelSettings(channelId, response);
    }

    private MacroscopDataResponse<MSCPChannelSettings> _getChannelSettings(
            MacroscopServerCredentials creds, String channelId) {
        return apiClient.exchange(
                MacroscopApiClient.Client.main,
                creds.address() + apiProperties.getApi() + apiProperties.getChannelsSubApi() + "/" + channelId,
                HttpMethod.GET,
                null,
                new MacroscopApiClient.AuthData(creds.login(), creds.passwordHash()),
                null,
                new TypeReference<MSCPChannelSettings>() {
                }
        ).orElse(apiClient.emptyErrorResponse());
    }

    private MacroscopDataResponse<List<MacroscopEvtPlaceDto>> _parsePlacesFromChannelSettings(
            String channelId,
            MacroscopDataResponse<MSCPChannelSettings> response) {
        var ret = new MacroscopDataResponse<List<MacroscopEvtPlaceDto>>(response);
        if (response.isSuccess() && response.getData() != null && response.getData().getAnalyzeSettings() != null
                && response.getData().getAnalyzeSettings().getMotionDetectorSettings() != null
                && response.getData().getAnalyzeSettings().getMotionDetectorSettings().getZones() != null) {
            var enabled = FALSE.equals(response.getData().getDisabled());
            var detectorEnabled = TRUE.equals(response.getData().getAnalyzeSettings().getMotionDetectorEnabled());
            var generateEventEnabled = TRUE.equals(response.getData().getAnalyzeSettings().getMotionDetectorSettings().getGenerationOfEventMotionStartAndEndEnabled());
            if (enabled && detectorEnabled && generateEventEnabled) {
                ret.setData(response.getData().getAnalyzeSettings().getMotionDetectorSettings().getZones().stream()
                        .map(v -> MacroscopEvtPlaceDto.builder()
                                .internalId(v.getId())
                                .name(v.getName())
                                .internalName(v.getName())
                                .channelId(channelId)
                                .actual(true)
                                .present(true)
                                .deleted(false)
                                .type(EvtAgentType.Macroscop.name())
                                .evtMode(MacroscopEvtAgentMode.byMovingDetector.name())
                                .build()).toList());
            } else {
                ret.setData(List.of());
                log.warn("_parsePlacesFromChannelSettings enabled={} detector={} generate={}", enabled, detectorEnabled, generateEventEnabled);
            }
        } else if (response.isSuccess()) {
            ret.setSuccess(false);
            ret.setErrorMessage("Incorrect channel config response");
        } else {
            ret.setSuccess(false);
            ret.setErrorMessage(response.getErrorMessage());
        }
        ret.setStatusCode(response.getStatusCode());
        return ret;
    }

    public MacroscopDataResponse<MacroscopEvtActionPlacesResponseDto> getPlacesFromAnalyticEventsForChannel(
            MacroscopServerCredentials creds, String channel,
            List<String> eventIds, ZonedDateTime before, int searchPlaceDepthInHours) {
        var end = before == null ? ZonedDateTime.now() : before;
        var start = end.minusHours(searchPlaceDepthInHours);
        var done = false;
        var ret = new MacroscopDataResponse<MacroscopEvtActionPlacesResponseDto>();
        while (!done) {
            var response = _getEventsOnChannelForPeriod(creds, channel, eventIds, start, end);
            end = _populatePlacesFromAnalyticEventsForChannelFromEventsOnChannel(ret, response);
            done = end == null;
        }
        if (ret.isSuccess() && ret.getData() != null) {
            ret.getData().setLastTime(start.minusSeconds(1L));
        }
        return ret;
    }

    private MacroscopDataResponse<List<MSCPActivityEvent>> _getEventsOnChannelForPeriod(
            MacroscopServerCredentials creds, String channel,
            List<String> eventIds, ZonedDateTime start, ZonedDateTime end
    ) {
        var req = MSCPEventRequest.builder()
                .startTimeUtc(toMacroscopBodyTime(start))
                .endTimeUtc(toMacroscopBodyTime(end))
                .searchFromBegin(false)
                .searchLimit(apiProperties.getEventsQueryLimit())
                .channelIds(List.of(channel))
                .eventIds(eventIds)
                .build();
        return apiClient.exchange(
                MacroscopApiClient.Client.main,
                creds.address() + apiProperties.getArchiveEventsApi(),
                HttpMethod.POST,
                Map.of("login", creds.login(), "password", creds.passwordHash()),
                new MacroscopApiClient.AuthData(creds.login(), creds.passwordHash()),
                req,
                new TypeReference<List<MSCPActivityEvent>>() {
                }
        ).orElse(apiClient.emptyErrorResponse());
    }

    private ZonedDateTime _populatePlacesFromAnalyticEventsForChannelFromEventsOnChannel(
            MacroscopDataResponse<MacroscopEvtActionPlacesResponseDto> ret,
            MacroscopDataResponse<List<MSCPActivityEvent>> response
    ) {
        ret.setStatusCode(response.getStatusCode());
        ret.setSuccess(response.isSuccess());
        if (!response.isSuccess()) {
            ret.setErrorMessage(response.getErrorMessage());
        }
        if (response.getData() == null) {
            ret.setSuccess(false);
            ret.setErrorMessage("Invalid Events response");
        }
        if (!ret.isSuccess() || response.getData().isEmpty()) {
            return null;
        }
        if (ret.getData() == null) {
            ret.setData(new MacroscopEvtActionPlacesResponseDto());
            ret.getData().setPlaces(new ArrayList<>());
        }
        var minTime = response.getData().stream()
                .map(MSCPActivityEvent::getTimestamp)
                .filter(Objects::nonNull)
                .min(OffsetDateTime::compareTo)
                .map(OffsetDateTime::toZonedDateTime)
                .orElse(null);
        var existingIds = ret.getData().getPlaces().stream()
                .map(MacroscopEvtPlaceDto::getInternalId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        response.getData().stream()
                .filter(e -> e.getEvent() != null && e.getEvent().getZoneId() != null)
                .forEach(e -> {
                    var detail = e.getEvent();
                    var zoneId = detail.getZoneId();
                    var zoneName = extractZoneNameFromComment(e.getEventComment());
                    if (existingIds.contains(zoneId)) return;
                    var place = MacroscopEvtPlaceDto.builder()
                            .internalId(zoneId)
                            .name(zoneName)
                            .internalName(zoneName)
                            .type(EvtAgentType.Macroscop.name())
                            .evtMode(MacroscopEvtAgentMode.byAnalytic.name())
                            .channelId(e.getChannelId())
                            .zoneInfo(MacroscopZoneInfoDto.builder()
                                    .left(detail.getLeft())
                                    .top(detail.getTop())
                                    .width(detail.getWidth())
                                    .height(detail.getHeight())
                                    .build())
                            .actual(true)
                            .present(true)
                            .deleted(false)
                            .used(true)
                            .build();

                    ret.getData().getPlaces().add(place);
                    existingIds.add(zoneId);
                });


        if (response.getData().size() < apiProperties.getEventsQueryLimit()) {
            return null;
        }
        return minTime;
    }
}
