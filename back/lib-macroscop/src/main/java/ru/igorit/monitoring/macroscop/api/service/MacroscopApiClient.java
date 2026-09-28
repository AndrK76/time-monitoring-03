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
import ru.igorit.monitoring.common.dto.common.BinaryContent;
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
                    log.error("Macroscop request failed: {} {}", method, url);
                    return Mono.just(networkErrorResponse(ex));
                })
                .blockOptional();
    }


    public Optional<MacroscopDataResponse<BinaryContent>> exchangeBinary(
            Client client,
            String url,
            HttpMethod method,
            Map<String, String> params
    ) {
        UriComponentsBuilder uriBuilder = UriComponentsBuilder.fromUriString(url);
        if (params != null && !params.isEmpty()) {
            params.forEach(uriBuilder::queryParam);
        }
        URI uri = uriBuilder.build().encode().toUri();

        return (client == Client.img ? imgClient : mainClient)
                .method(method)
                .uri(uri)
                .accept(MediaType.ALL)
                .exchangeToMono(response -> {
                    HttpStatusCode status = response.statusCode();
                    MediaType ct = response.headers().contentType().orElse(null);

                    if (!status.is2xxSuccessful()) {
                        return response.bodyToMono(String.class)
                                .defaultIfEmpty("")
                                .map(body -> binaryError(
                                        status.value(),
                                        "Macroscop returned " + status.value() + ": " + sanitizeMessage(body)));
                    }

                    if (isBinary(ct)) {
                        return response.bodyToMono(byte[].class)
                                .map(bytes -> {
                                    log.debug("Macroscop binary response: {} bytes, contentType={}", bytes.length, ct);
                                    return MacroscopDataResponse.<BinaryContent>builder()
                                            .statusCode(status.value())
                                            .success(true)
                                            .data(BinaryContent.builder()
                                                    .data(bytes)
                                                    .contentType(ct.getType() + "/" + ct.getSubtype())
                                                    .build())
                                            .build();
                                });
                    }

                    // 2xx + не бинарный тип = ошибка в теле
                    return response.bodyToMono(String.class)
                            .defaultIfEmpty("")
                            .map(body -> {
                                String msg = sanitizeMessage(body);
                                log.warn("Macroscop returned 2xx with non-binary content-type {} and body: {}",
                                        ct, msg);
                                return binaryError(status.value(),
                                        "Macroscop: " + (msg.isBlank() ? "unknown error" : msg));
                            });
                })
                .onErrorResume(ex -> {
                    if (ex instanceof org.springframework.core.io.buffer.DataBufferLimitException) {
                        log.error("Macroscop binary response too large for maxInMemorySize", ex);
                        return Mono.just(binaryError(502, "Ответ Macroscop превышает допустимый размер"));
                    }
                    log.error("Macroscop binary request failed: {} {}", method, uri);
                    return Mono.just(binaryError(503, "Ошибка сети: " + ex.getMessage()));
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


    private MacroscopDataResponse<BinaryContent> binaryError(
            int statusCode, String message
    ) {
        MacroscopDataResponse<BinaryContent> ret = new MacroscopDataResponse<>();
        ret.setStatusCode(statusCode);
        ret.setSuccess(false);
        ret.setData(null);
        ret.setErrorMessage(message);
        return ret;
    }

    private static boolean isBinary(MediaType ct) {
        if (ct == null) return false;
        String type = ct.getType().toLowerCase();
        return "image".equals(type)
                || "video".equals(type)
                || ("application".equals(type) && "octet-stream".equalsIgnoreCase(ct.getSubtype()));
    }

    public enum Client {
        main, img
    }
}
