package ru.igorit.monitoring.common.util;

import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;

public final class TimeUtils {

    private TimeUtils() {
    }

    // ============================================================
    // ZonedDateTime ↔ OffsetDateTime
    // ============================================================

    public static OffsetDateTime zonedToOffset(ZonedDateTime zdt) {
        return zdt == null ? null : zdt.toOffsetDateTime();
    }

    public static ZonedDateTime offsetToZoned(OffsetDateTime odt) {
        return odt == null ? null : odt.toZonedDateTime();
    }

    // ============================================================
    // ZoneOffset ↔ String (в формате "+03:00")
    // ============================================================

    public static String zoneOffsetToString(ZoneOffset z) {
        return z == null ? null : z.getId();
    }

    public static ZoneOffset stringToZoneOffset(String s) {
        if (s == null || s.isBlank()) return null;
        try {
            return ZoneOffset.of(s);
        } catch (RuntimeException e) {
            return null;
        }
    }

    public static ZonedDateTime offsetToZonedWithTz(OffsetDateTime odt, String tz) {
        if (odt == null) return null;
        return odt.toInstant().atZone(stringToZoneIdOr(tz, ZoneId.systemDefault()));
    }

    public static ZoneId stringToZoneIdOr(String tz, ZoneId fallback) {
        if (tz == null || tz.isBlank()) return fallback;
        try {
            return ZoneOffset.of(tz);
        } catch (RuntimeException e) {
            return fallback;
        }
    }
}