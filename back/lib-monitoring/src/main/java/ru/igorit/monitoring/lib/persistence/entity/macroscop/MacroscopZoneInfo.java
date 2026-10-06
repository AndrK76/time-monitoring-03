package ru.igorit.monitoring.lib.persistence.entity.macroscop;

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
public class MacroscopZoneInfo {
    @Column(name = "macroscop_zone_left")
    private Double left;
    @Column(name = "macroscop_zone_top")
    private Double top;
    @Column(name = "macroscop_zone_width")
    private Double width;
    @Column(name = "macroscop_zone_height")
    private Double height;
}
