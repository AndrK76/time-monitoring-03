package ru.igorit.monitoring.macroscop.service.manage;

import com.fasterxml.jackson.core.type.TypeReference;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;
import ru.igorit.monitoring.common.dto.common.BinaryContent;
import ru.igorit.monitoring.lib.dto.macroscop.*;
import ru.igorit.monitoring.lib.persistence.entity.macroscop.MacroscopArchiveMode;
import ru.igorit.monitoring.macroscop.api.config.MacroscopApiProperties;
import ru.igorit.monitoring.macroscop.api.dto.MSCPChannel;
import ru.igorit.monitoring.macroscop.api.dto.MSCPConfigResponse;
import ru.igorit.monitoring.macroscop.api.service.MacroscopApiClient;

import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import static ru.igorit.monitoring.macroscop.api.utils.MacroscopParseUtils.*;

@Service
@Log4j2
@RequiredArgsConstructor
public class MSCPConfigManageService {
    private final MacroscopApiProperties apiProperties;
    private final MacroscopApiClient apiClient;

    public MacroscopDataResponse<MacroscopServerInfoDto> getServerInfo(MacroscopServerCredentials creds) {
        var response = _getServerInfo(creds);
        return _parseServerInfoResponse(response);
    }

    private MacroscopDataResponse<MSCPConfigResponse> _getServerInfo(MacroscopServerCredentials creds) {
        return apiClient.exchange(
                MacroscopApiClient.Client.main,
                creds.address() + apiProperties.getServerConfigApi(),
                HttpMethod.GET,
                Map.of("login", creds.login(), "password", creds.passwordHash(), "responsetype", "json"),
                null,
                new TypeReference<MSCPConfigResponse>() {
                }
        ).orElse(apiClient.emptyErrorResponse());
    }

    private MacroscopDataResponse<MacroscopServerInfoDto> _parseServerInfoResponse(MacroscopDataResponse<MSCPConfigResponse> response) {
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
                )
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
                        "starttime",toMacroscopTime(ZonedDateTime.now())
                )
        ).orElse(apiClient.emptyErrorResponse());
    }

}
