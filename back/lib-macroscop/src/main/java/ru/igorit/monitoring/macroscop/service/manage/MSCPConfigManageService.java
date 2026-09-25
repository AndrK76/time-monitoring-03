package ru.igorit.monitoring.macroscop.service.manage;

import com.fasterxml.jackson.core.type.TypeReference;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Service;
import ru.igorit.monitoring.lib.dto.macroscop.MacroscopDataResponse;
import ru.igorit.monitoring.lib.dto.macroscop.MacroscopServerCredentials;
import ru.igorit.monitoring.lib.dto.macroscop.MacroscopServerInfoDto;
import ru.igorit.monitoring.macroscop.api.config.MacroscopApiProperties;
import ru.igorit.monitoring.macroscop.api.dto.MSCPConfigResponse;
import ru.igorit.monitoring.macroscop.api.service.MacroscopApiClient;

import java.time.ZoneOffset;
import java.util.Map;

import static ru.igorit.monitoring.macroscop.api.utils.MacroscopParseUtils.extractZoneOffset;
import static ru.igorit.monitoring.macroscop.api.utils.MacroscopParseUtils.parseTimestamp;

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
        }
        return ret;
    }


}
