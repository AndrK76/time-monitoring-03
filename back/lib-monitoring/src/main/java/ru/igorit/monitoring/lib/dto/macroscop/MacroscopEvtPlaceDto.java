package ru.igorit.monitoring.lib.dto.macroscop;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MacroscopEvtPlaceDto implements Comparable<MacroscopEvtPlaceDto> {
    private String id;
    private String type;
    private String name;
    private String internalName;
    private String internalId;
    private String evtMode;
    private String channelId;
    private MacroscopZoneInfoDto zoneInfo;
    private boolean used;
    private boolean actual;
    private boolean present;
    private boolean deleted;

    @Override
    public int compareTo(MacroscopEvtPlaceDto other) {
        if (other == null) return 1;

        int cmp = compareNullable(this.channelId, other.channelId);
        if (cmp != 0) return cmp;

        boolean thisHasZone = this.zoneInfo != null;
        boolean otherHasZone = other.zoneInfo != null;
        if (thisHasZone != otherHasZone) {
            return thisHasZone ? -1 : 1;
        }

        if (thisHasZone) {
            cmp = compareNullableDouble(this.zoneInfo.getLeft(), other.zoneInfo.getLeft());
            if (cmp != 0) return cmp;
            cmp = compareNullableDouble(this.zoneInfo.getTop(), other.zoneInfo.getTop());
            if (cmp != 0) return cmp;
        }

        cmp = compareNullable(this.internalName, other.internalName);
        if (cmp != 0) return cmp;

        return compareNullable(this.internalId, other.internalId);
    }

    private static int compareNullable(String a, String b) {
        if (a == null && b == null) return 0;
        if (a == null) return 1;
        if (b == null) return -1;
        return a.compareTo(b);
    }

    private static int compareNullableDouble(Double a, Double b) {
        if (a == null && b == null) return 0;
        if (a == null) return 1;
        if (b == null) return -1;
        return Double.compare(a, b);
    }
}