package ru.igorit.monitoring.lib.persistence.entity.macroscop;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import ru.igorit.monitoring.lib.persistence.entity.evt.EvtPlace;

@Entity
@DiscriminatorValue("MACROSCOP")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class MacroscopEvtPlace extends EvtPlace {

    @ManyToOne(fetch = FetchType.LAZY, optional = true)
    @JoinColumn(
            name = "macroscop_channel_id", referencedColumnName = "id", nullable = true,
            foreignKey = @ForeignKey(name = "fk_macroscop_evt_places_channel", value = ConstraintMode.CONSTRAINT)
    )
    private MacroscopChannel channel;

    @Column(name = "macroscop_orig_channel_id", nullable = false)
    private String origChannelId;

    @Column(name = "macroscop_zone_id", nullable = false, length = 255)
    private String macroscopZoneId;

    @Column(name = "macroscop_zone_name", nullable = false, length = 255)
    private String macroscopZoneName;

    @Embedded
    private MacroscopZoneInfo zoneInfo;

    @Override
    public String getInternalName() {
        return macroscopZoneName;
    }

    @Override
    public String getInternalId() {
        return macroscopZoneId;
    }
}
