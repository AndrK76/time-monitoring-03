package ru.igorit.monitoring.yclients.service;

import com.fasterxml.jackson.core.type.TypeReference;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Service;
import ru.igorit.monitoring.lib.dto.yclients.YClientsTokenRequestDto;
import ru.igorit.monitoring.lib.dto.yclients.YClientsTokenResponseDto;
import ru.igorit.monitoring.yclients.api.config.YClientsApiProperties;
import ru.igorit.monitoring.yclients.api.dto.YCAuthParams;
import ru.igorit.monitoring.yclients.api.dto.YCAuthResponse;
import ru.igorit.monitoring.yclients.api.dto.YCResponse;

import java.util.Map;

@Service

@Log4j2
@RequiredArgsConstructor
public class ConfigManageService {
    private final YClientsApiProperties apiProperties;
    private final YClientsApiClient apiClient;


    public YClientsTokenResponseDto getClientToken(YClientsTokenRequestDto request) {
        var response = _getClientToken(request);
        return parse(response);
    }

    private YCResponse<YCAuthResponse, Map<String, String>> _getClientToken(YClientsTokenRequestDto request) {
        YCAuthParams params = new YCAuthParams(request.getLogin(), request.getPassword());
        TypeReference<Map<String, String>> metaType = new TypeReference<>() {};

        return apiClient.exchange(
                apiProperties.getApiUrl() + apiProperties.getAuthApi(),
                HttpMethod.POST,
                request.getPartnerToken(),
                null,
                null,
                params,
                new TypeReference<YCAuthResponse>() {},
                metaType
        ).orElse(apiClient.emptyErrorResponse(metaType));
    }

    private YClientsTokenResponseDto parse(YCResponse<YCAuthResponse, Map<String, String>> response) {
        if (response.isSuccess()) {
            return YClientsTokenResponseDto.builder()
                    .statusCode(response.getStatus().value())
                    .statusMessage(response.getStatus().toString())
                    .success(true)
                    .userToken(response.getData().getUser_token())
                    .build();
        } else {
            return YClientsTokenResponseDto.builder()
                    .statusCode(response.getStatus().value())
                    .statusMessage(response.getStatus().toString())
                    .success(false)
                    .errorMessage(response.getMeta().get("message"))
                    .build();
        }
    }
}
