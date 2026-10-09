package ru.igorit.monitoring.lib.persistence.entity.macroscop;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.ZonedDateTime;

@Entity
@Table(name = "macroscop_zone_info")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class MacroscopZoneInfo {

    private static final double ZONE_MIN_DELTA = 1e-2;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "place_id", nullable = false)
    private MacroscopEvtPlace place;

    @Column(name = "macroscop_zone_left")
    private Double left;

    @Column(name = "macroscop_zone_top")
    private Double top;

    @Column(name = "macroscop_zone_width")
    private Double width;

    @Column(name = "macroscop_zone_height")
    private Double height;

    @Column(name = "valid_from", nullable = false)
    private ZonedDateTime validFrom;

    @Column(name = "valid_to")
    private ZonedDateTime validTo;

    public boolean isOpen() {
        return validTo == null;
    }

    public static boolean _zoneDiffers(MacroscopZoneInfo a, MacroscopZoneInfo b) {
        return _differs(a.getLeft(),   b.getLeft())
                || _differs(a.getTop(),    b.getTop())
                || _differs(a.getWidth(),  b.getWidth())
                || _differs(a.getHeight(), b.getHeight());
    }

    private static boolean _differs(Double a, Double b) {
        if (a == null && b == null) return false;
        if (a == null || b == null) return true;
        return Math.abs(a - b) > ZONE_MIN_DELTA;
    }
}