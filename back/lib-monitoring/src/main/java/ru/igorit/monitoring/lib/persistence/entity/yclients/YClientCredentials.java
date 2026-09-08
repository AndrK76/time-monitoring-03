package ru.igorit.monitoring.lib.persistence.entity.yclients;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Embeddable
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class YClientCredentials {
    @Column(name = "api_url", nullable = false, length = 255)
    private String apiUrl;
    @Column(name = "partner_token", nullable = false, length = 255)
    private String partnerToken;
    @Column(name = "user_token", length = 255)
    private String userToken;
}