package ru.igorit.monitoring.macroscop.api.utils;

import lombok.extern.log4j.Log4j2;
import ru.igorit.monitoring.macroscop.api.dto.MSCPChannel;
import ru.igorit.monitoring.macroscop.service.manage.MSCPConfigManageService;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Objects;

@Log4j2
public class MacroscopParseUtils {
    public static ZoneOffset extractZoneOffset(List<MSCPChannel> channels) {
        if (channels == null || channels.isEmpty()) {
            return null;
        }
        return channels.stream()
                .map(MSCPChannel::getTimeZoneOffset)
                .filter(Objects::nonNull)
                .findFirst()
                .map(MacroscopParseUtils::hoursToZoneOffset)
                .orElse(null);
    }

    public static ZoneOffset hoursToZoneOffset(double hours) {
        return ZoneOffset.ofTotalSeconds((int) Math.round(hours * 3600));
    }

    public static Instant parseTimestamp(String timestamp) {
        if (timestamp == null || timestamp.isBlank()) {
            return Instant.now();
        }
        try {
            return Instant.parse(timestamp);
        } catch (DateTimeParseException e) {
            log.warn("Invalid Macroscop timestamp in server info: {}", timestamp);
            return Instant.now();
        }
    }

    public static String sanitizeMessage(String src) {
        if (src == null) {
            return null;
        }
        return src
                .replace("\uFEFF", "")         // BOM
                .replace("\r\n", ". ")          // Windows → пробел
                .replace('\r', ' ')             // одиночный CR → пробел
                .replace('\n', ' ')             // LF → пробел
                .replaceAll(" {2,}", " ")      // схлопываем двойные пробелы
                .replace(". .", ".")
                .trim();
    }
}
