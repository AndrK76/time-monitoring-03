package ru.igorit.monitoring.lib.dto.yclients;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class YClientsTokenResponseDto {
    private int statusCode;
    private String statusMessage;
    private boolean success;
    private String errorMessage;
    private String userToken;

    @Override
    public String toString() {
        return "YClientsTokenResponse{" +
                "statusCode=" + statusCode +
                ", statusMessage='" + statusMessage + '\'' +
                ", success=" + success +
                ", errorMessage='" + errorMessage + '\'' +
                ", userToken='" + userToken + '\'' +
                '}';
    }
}
