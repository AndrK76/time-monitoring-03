package ru.igorit.monitoring.macroscop.api.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.util.UriComponentsBuilder;
import reactor.core.publisher.Mono;
import ru.igorit.monitoring.lib.dto.macroscop.MacroscopDataResponse;

import java.net.URI;
import java.util.Map;
import java.util.Optional;

import static ru.igorit.monitoring.macroscop.api.utils.MacroscopParseUtils.sanitizeMessage;

@Component
@Log4j2
public class MacroscopApiClient {

    private final WebClient mainClient;
    private final WebClient imgClient;
    private final ObjectMapper objectMapper;

    public MacroscopApiClient(
            @Qualifier("macroscopWebClient") WebClient mainClient,
            @Qualifier("macroscopImgWebClient") WebClient imgClient,
            @Qualifier("macroscopWebClientObjectMapper") ObjectMapper objectMapper) {
        this.mainClient = mainClient;
        this.imgClient = imgClient;
        this.objectMapper = objectMapper;
    }

    public <TData> Optional<MacroscopDataResponse<TData>> exchange(
            Client client,
            String url,
            HttpMethod method,
            Map<String, String> params,
            Object body,
            TypeReference<TData> dataType
    ) {
        UriComponentsBuilder uriBuilder = UriComponentsBuilder.fromUriString(url);
        if (params != null && !params.isEmpty()) {
            params.forEach(uriBuilder::queryParam);
        }
        URI uri = uriBuilder.build().encode().toUri();

        WebClient.RequestBodySpec spec = (client == Client.img ? imgClient : mainClient).method(method)
                .uri(uri)
                .accept(MediaType.APPLICATION_JSON)
                .contentType(MediaType.APPLICATION_JSON);
        WebClient.RequestHeadersSpec<?> readySpec;
        if (body != null) {
            readySpec = spec.bodyValue(body);
        } else {
            readySpec = spec;
        }

        return readySpec
                .exchangeToMono(response -> response.bodyToMono(String.class)
                        .defaultIfEmpty("")
                        .map(rawBody -> parseResponse(response.statusCode(), rawBody, dataType)
                        ))
                .onErrorResume(ex -> {
                    log.error("YClients request failed: {} {}", method, url, ex);
                    return Mono.just(networkErrorResponse(ex));
                })
                .blockOptional();
    }

    public <TData> MacroscopDataResponse<TData> emptyErrorResponse() {
        MacroscopDataResponse<TData> result = new MacroscopDataResponse<>();
        result.setStatusCode(503);
        result.setSuccess(false);
        result.setData(null);
        result.setErrorMessage("Пустой ответ");
        return result;
    }

    private <TData> MacroscopDataResponse<TData> networkErrorResponse(Throwable ex) {
        MacroscopDataResponse<TData> result = new MacroscopDataResponse<>();
        result.setStatusCode(503);
        result.setSuccess(false);
        result.setData(null);
        result.setErrorMessage("Ошибка сети: " + ex.getMessage());
        return result;
    }

    private <TData> MacroscopDataResponse<TData> parseResponse(HttpStatusCode status,
                                                               String rawBody,
                                                               TypeReference<TData> dataType) {
        MacroscopDataResponse<TData> result = new MacroscopDataResponse<>();

        result.setStatusCode(status.value());
        result.setSuccess(status.is2xxSuccessful());

        if (rawBody == null || rawBody.isBlank()) {
            if (!status.is2xxSuccessful()) {
                result.setErrorMessage("Пустой ответ сервера, статус " + status.value());
            }
            return result;
        }
        if (dataType != null) {
            try {
                TData data = objectMapper.readValue(rawBody, dataType);
                result.setData(data);
            } catch (Exception e) {
                log.warn("Failed to convert data to expected type. data={}", rawBody);
                result.setSuccess(false);
                result.setErrorMessage(sanitizeMessage(rawBody));
                result.setData(null);
                return result;
            }
        }
        return result;
    }

    public enum Client {
        main, img
    }
}
