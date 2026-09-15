package ru.igorit.monitoring.yclients.service.manage;

import com.fasterxml.jackson.core.type.TypeReference;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Service;
import ru.igorit.monitoring.lib.dto.yclients.*;
import ru.igorit.monitoring.yclients.api.config.YClientsApiProperties;
import ru.igorit.monitoring.yclients.api.dto.*;
import ru.igorit.monitoring.yclients.api.service.YClientsApiClient;

import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

@Service

@Log4j2
@RequiredArgsConstructor
public class ConfigManageService {
    private final YClientsApiProperties apiProperties;
    private final YClientsApiClient apiClient;

    private final TypeReference<Map<String, String>> metaType = new TypeReference<>() {
    };


    public YClientsTokenResponseDto getClientToken(YClientsTokenRequestDto request) {
        var response = _getClientToken(request);
        return parseClientTokenResponse(response);
    }

    private YCResponse<YCAuthResponse, Map<String, String>> _getClientToken(YClientsTokenRequestDto request) {
        YCAuthParams params = new YCAuthParams(request.getLogin(), request.getPassword());

        return apiClient.exchange(
                apiProperties.getApiUrl() + apiProperties.getAuthApi(),
                HttpMethod.POST,
                request.getPartnerToken(),
                null,
                null,
                params,
                new TypeReference<YCAuthResponse>() {
                },
                metaType
        ).orElse(apiClient.emptyErrorResponse(metaType));
    }

    private YClientsTokenResponseDto parseClientTokenResponse(YCResponse<YCAuthResponse, Map<String, String>> response) {
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


    public YClientsDataResponse<List<YClientsOrganizationDto>> getClientOrganizations(YClientCredentialsDto request) {
        var response = _getClientOrganizations(request);
        return parseClientOrganizationsResponse(response);
    }

    private YCResponse<List<YCOrgInfo>, Map<String, String>> _getClientOrganizations(YClientCredentialsDto request) {
        return apiClient.exchange(
                apiProperties.getApiUrl() + apiProperties.getCompaniesApi(),
                HttpMethod.GET,
                request.getPartnerToken(),
                request.getUserToken(),
                Map.of("my", "1"),
                null,
                new TypeReference<List<YCOrgInfo>>() {
                },
                metaType
        ).orElse(apiClient.emptyErrorResponse(metaType));
    }

    private YClientsDataResponse<List<YClientsOrganizationDto>> parseClientOrganizationsResponse(YCResponse<List<YCOrgInfo>, Map<String, String>> response) {
        if (response.isSuccess()) {
            return YClientsDataResponse.<List<YClientsOrganizationDto>>builder()
                    .statusCode(response.getStatus().value())
                    .statusMessage(response.getStatus().toString())
                    .success(true)
                    .data(response.getData().stream().map(v ->
                            YClientsOrganizationDto.builder()
                                    .ycId((long) v.getId())
                                    .name(v.getTitle())
                                    .timezone(ZoneOffset.ofHours(v.getTimezone()).toString())
                                    .build()
                    ).toList())
                    .meta(response.getMeta())
                    .build();
        } else {
            return YClientsDataResponse.<List<YClientsOrganizationDto>>builder()
                    .statusCode(response.getStatus().value())
                    .statusMessage(response.getStatus().toString())
                    .success(false)
                    .errorMessage(response.getMeta().get("message"))
                    .meta(response.getMeta())
                    .build();
        }
    }


    public YClientsDataResponse<List<YClientsServiceCategoryListDto>> getOrganizationServiceCategories(long orgId, YClientCredentialsDto request) {
        var response = _getOrganizationServiceCategories(orgId, request);
        return parseOrganizationServiceCategoriesResponse(orgId, response);
    }

    private YCResponse<List<YCServiceCategoryInfo>, Map<String, String>> _getOrganizationServiceCategories(long orgId, YClientCredentialsDto request) {
        return apiClient.exchange(
                apiProperties.getApiUrl() + apiProperties.getCompanyApi() + "/" + orgId + apiProperties.getServiceCategoriesApi(),
                HttpMethod.GET,
                request.getPartnerToken(),
                request.getUserToken(),
                null,
                null,
                new TypeReference<List<YCServiceCategoryInfo>>() {
                },
                metaType
        ).orElse(apiClient.emptyErrorResponse(metaType));
    }

    private YClientsDataResponse<List<YClientsServiceCategoryListDto>> parseOrganizationServiceCategoriesResponse(
            Long orgId,
            YCResponse<List<YCServiceCategoryInfo>, Map<String, String>> response) {
        if (response.isSuccess()) {
            return YClientsDataResponse.<List<YClientsServiceCategoryListDto>>builder()
                    .statusCode(response.getStatus().value())
                    .statusMessage(response.getStatus().toString())
                    .success(true)
                    .data(response.getData().stream().map(v ->
                            YClientsServiceCategoryListDto.builder()
                                    .id((long) v.getId())
                                    .name(v.getTitle())
                                    .orgId(orgId)
                                    .build()
                    ).toList())
                    .meta(response.getMeta())
                    .build();
        } else {
            return YClientsDataResponse.<List<YClientsServiceCategoryListDto>>builder()
                    .statusCode(response.getStatus().value())
                    .statusMessage(response.getStatus().toString())
                    .success(false)
                    .errorMessage(response.getMeta().get("message"))
                    .meta(response.getMeta())
                    .build();
        }
    }

    public YClientsDataResponse<List<YClientsServiceDto>> getServicesForOrganization(long orgId, List<Long> catIds, YClientCredentialsDto request) {
        var response = _getServicesForOrganization(orgId, request);
        return parseServicesForOrganizationResponse(catIds,response);
    }

    private YCResponse<List<YCServiceInfo>, Map<String, String>> _getServicesForOrganization(long orgId, YClientCredentialsDto request) {
        return apiClient.exchange(
                apiProperties.getApiUrl() + apiProperties.getCompanyApi() + "/" + orgId + apiProperties.getServicesApi(),
                HttpMethod.GET,
                request.getPartnerToken(),
                request.getUserToken(),
                null,
                null,
                new TypeReference<List<YCServiceInfo>>() {
                },
                metaType
        ).orElse(apiClient.emptyErrorResponse(metaType));
    }

    private YClientsDataResponse<List<YClientsServiceDto>> parseServicesForOrganizationResponse(
            List<Long> catIds,
            YCResponse<List<YCServiceInfo>, Map<String, String>> response) {
        if (response.isSuccess()) {
            return YClientsDataResponse.<List<YClientsServiceDto>>builder()
                    .statusCode(response.getStatus().value())
                    .statusMessage(response.getStatus().toString())
                    .success(true)
                    .data(response.getData().stream()
                            .filter(f->f.getActive()==1 && catIds.contains((long)f.getCategory_id()))
                            .map(v -> YClientsServiceDto.builder()
                                    .ycId(v.getId())
                                    .ycName(v.getTitle())
                                    .categoryId(v.getCategory_id())
                                    .build()
                            ).toList())
                    .meta(response.getMeta())
                    .build();
        } else {
            return YClientsDataResponse.<List<YClientsServiceDto>>builder()
                    .statusCode(response.getStatus().value())
                    .statusMessage(response.getStatus().toString())
                    .success(false)
                    .errorMessage(response.getMeta().get("message"))
                    .meta(response.getMeta())
                    .build();
        }
    }


}
