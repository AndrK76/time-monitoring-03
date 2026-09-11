package ru.igorit.monitoring.yclients.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class YCAuthResponse {
    private Integer id;
    private String user_token;
    private String name;
    private String login;
}
