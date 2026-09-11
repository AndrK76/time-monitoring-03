package ru.igorit.monitoring.yclients.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import ru.igorit.monitoring.yclients.api.dto.YCResponse;

import java.util.Map;
import java.util.Optional;

@Component
@Log4j2
public class YClientsApiClient {

    private static final MediaType YC_ACCEPT = new MediaType("application", "vnd.yclients.v2+json");

    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    public YClientsApiClient(@Qualifier("yclientsWebClient") WebClient webClient,
                             @Qualifier("yclientsWebClientObjectMapper") ObjectMapper objectMapper) {
        this.webClient = webClient;
        this.objectMapper = objectMapper;
    }

    /**
     * Извлекает текст ошибки из ответа YClients.
     * Работает с любым вариантом типизации YCResponse.
     */
    public String extractError(YCResponse<?, ?> response) {
        if (response == null) {
            return "Не известная ошибка";
        }
        Object meta = response.getMeta();
        if (meta != null) {
            if (meta instanceof String s) {
                return s;
            }
            if (meta instanceof Map<?, ?> map) {
                Object message = map.get("message");
                if (message != null) {
                    return message.toString();
                }
            }
        }
        Object data = response.getData();
        if (data instanceof String s) {
            return s;
        }
        return "Не известная ошибка";
    }

    /**
     * Универсальный вызов YClients API.
     *
     * @param dataType тип, в который конвертируется поле data (может быть null).
     * @param metaType тип, в который конвертируется поле meta (обычно Map<String,String>).
     * @return Optional.empty() — если поток пустой (маловероятно при onErrorResume),
     * иначе типизированный YCResponse.
     */
    public <TData, TMeta> Optional<YCResponse<TData, TMeta>> exchange(
            String url,
            HttpMethod method,
            String partnerToken,
            String userToken,
            Map<String, String> params,
            Object body,
            TypeReference<TData> dataType,
            TypeReference<TMeta> metaType) {

        WebClient.RequestBodySpec spec = webClient.method(method)
                .uri(url)
                .accept(YC_ACCEPT)
                .contentType(MediaType.APPLICATION_JSON);

        if (partnerToken != null && !partnerToken.isBlank()) {
            StringBuilder sb = new StringBuilder("Bearer ").append(partnerToken);
            if (userToken != null && !userToken.isBlank()) {
                sb.append(", User ").append(userToken);
            }
            spec = spec.header("Authorization", sb.toString());
        }

        WebClient.RequestHeadersSpec<?> readySpec;
        if (body != null) {
            readySpec = spec.bodyValue(body);
        } else {
            readySpec = spec;
        }

        return readySpec
                .exchangeToMono(response -> response.bodyToMono(String.class)
                        .defaultIfEmpty("")
                        .map(rawBody -> parseResponse(response.statusCode(), rawBody, dataType, metaType)))
                .onErrorResume(ex -> {
                    log.error("YClients request failed: {} {}", method, url, ex);
                    return Mono.just(networkErrorResponse(ex, metaType));
                })
                .blockOptional();
    }

    /**
     * Разбор ответа:
     * 1. Пустое тело — заполняем meta сообщением (для не-2xx).
     * 2. Парсим как YCResponse<Object, Object>, затем конвертируем data и meta
     * в переданные типы.
     * 3. Все ошибки фиксируем в success=false и meta.message.
     */
    private <TData, TMeta> YCResponse<TData, TMeta> parseResponse(HttpStatusCode status,
                                                                  String rawBody,
                                                                  TypeReference<TData> dataType,
                                                                  TypeReference<TMeta> metaType) {
        YCResponse<TData, TMeta> result = new YCResponse<>();
        result.setStatus(status);

        if (rawBody == null || rawBody.isBlank()) {
            result.setSuccess(status.is2xxSuccessful());
            if (!status.is2xxSuccessful()) {
                result.setMeta(metaMessage("Пустой ответ сервера, статус " + status.value(), metaType));
            }
            return result;
        }

        // 1. Парсим как YCResponse<Object, Object>
        YCResponse<Object, Object> raw;
        try {
            raw = objectMapper.readValue(rawBody, new TypeReference<YCResponse<Object, Object>>() {
            });
            raw.setStatus(status);
        } catch (Exception e) {
            log.warn("YClients response is not a valid YCResponse. Status={}, body={}",
                    status.value(), rawBody, e);
            result.setSuccess(false);
            result.setData(null);
            result.setMeta(metaMessage("Некорректный ответ сервера (статус " + status.value() + "): " + e.getMessage(), metaType));
            return result;
        }

        result.setSuccess(raw.isSuccess());

        // 2. Конвертируем data в нужный тип
        if (raw.getData() != null && dataType != null) {
            try {
                TData data = objectMapper.convertValue(raw.getData(), dataType);
                result.setData(data);
            } catch (Exception e) {
                log.warn("Failed to convert data to expected type. data={}", raw.getData(), e);
                result.setSuccess(false);
                result.setData(null);
                result.setMeta(metaMessage("Не удалось разобрать data ответа: " + e.getMessage(), metaType));
                return result;
            }
        }

        // 3. Конвертируем meta в нужный тип (обычно Map<String, String>)
        if (metaType != null) {
            Object rawMeta = raw.getMeta();
            // Нормализуем meta: [] или {} -> пустая Map, строка -> Map с message
            Map<String, Object> normalizedMeta = normalizeMeta(rawMeta);
            try {
                TMeta meta = objectMapper.convertValue(normalizedMeta, metaType);
                result.setMeta(meta);
            } catch (Exception e) {
                log.debug("Failed to convert meta. meta={}", rawMeta, e);
                result.setMeta(metaMessage(null, metaType));
            }
        }
        return result;
    }

    /**
     * Формирует meta нужного типа с сообщением message.
     * Если message == null — вернёт "пустое" значение для metaType.
     */
    private <TMeta> TMeta metaMessage(String message, TypeReference<TMeta> metaType) {
        if (metaType == null) return null;
        try {
            if (message == null) {
                return objectMapper.convertValue(Map.of(), metaType);
            }
            return objectMapper.convertValue(Map.of("message", message), metaType);
        } catch (Exception e) {
            log.warn("Failed to create meta message. message={}", message, e);
            return null;
        }
    }

    /**
     * Ответ при сетевой ошибке: data = null, meta = Map с сообщением.
     */
    private <TData, TMeta> YCResponse<TData, TMeta> networkErrorResponse(Throwable ex, TypeReference<TMeta> metaType) {
        YCResponse<TData, TMeta> result = new YCResponse<>();
        result.setStatus(HttpStatusCode.valueOf(503));
        result.setSuccess(false);
        result.setData(null);
        result.setMeta(metaMessage("Ошибка сети: " + ex.getMessage(), metaType));
        return result;
    }

    /**
     * Заготовка ответа для случая, когда вообще нет ответа (Optional.empty).
     */
    public <TData, TMeta> YCResponse<TData, TMeta> emptyErrorResponse(TypeReference<TMeta> metaType) {
        YCResponse<TData, TMeta> result = new YCResponse<>();
        result.setStatus(HttpStatusCode.valueOf(503));
        result.setSuccess(false);
        result.setData(null);
        result.setMeta(metaMessage("Пустой ответ", metaType));
        return result;
    }

    /**
     * Приводим meta из ответа YClients к Map<String,Object>.
     * YClients может вернуть:
     *   null      -> пустая Map
     *   []        -> пустая Map
     *   {}        -> пустая Map
     *   {...}     -> Map как есть
     *   "string"  -> Map с ключом message
     */
    private Map<String, Object> normalizeMeta(Object rawMeta) {
        if (rawMeta == null) {
            return Map.of();
        }
        if (rawMeta instanceof Map<?, ?> map) {
            // Проверяем, что ключи строковые; иначе — преобразуем
            Map<String, Object> result = new java.util.LinkedHashMap<>();
            for (Map.Entry<?, ?> e : map.entrySet()) {
                result.put(String.valueOf(e.getKey()), e.getValue());
            }
            return result;
        }
        if (rawMeta instanceof java.util.List<?> list) {
            // Пустой список трактуем как отсутствие meta
            if (list.isEmpty()) {
                return Map.of();
            }
            // Непустой список — кладём как значение message (на всякий случай)
            return Map.of("message", list.toString());
        }
        if (rawMeta instanceof String s) {
            return Map.of("message", s);
        }
        return Map.of("message", rawMeta.toString());
    }
}