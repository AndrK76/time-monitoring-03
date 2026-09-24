package ru.igorit.monitoring.lib.dto.macroscop;

public record MacroscopServerCredentials(
        String address, String login, String passwordHash
) {
}
