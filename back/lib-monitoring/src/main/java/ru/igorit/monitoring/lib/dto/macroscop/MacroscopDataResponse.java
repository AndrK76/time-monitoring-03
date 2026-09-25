package ru.igorit.monitoring.lib.dto.macroscop;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MacroscopDataResponse<T> {
    private int statusCode;
    private boolean success;
    private String errorMessage;
    private T data;

    public MacroscopDataResponse(MacroscopDataResponse<?> source) {
        this(
                source.getStatusCode(),
                source.isSuccess(),
                source.getErrorMessage(),
                null
        );
    }
}
