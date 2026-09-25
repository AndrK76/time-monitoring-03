package ru.igorit.monitoring.lib.dto.macroscop;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;

public record MacroscopServerCredentials(
        @NotBlank String address,
        @NotBlank String login,
        @NotBlank @JsonProperty("password") String passwordHash
) {
}
