package ru.igorit.monitoring.lib.persistence.entity.macroscop;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import ru.igorit.monitoring.lib.persistence.entity.img.ImgPlace;

@Entity
@DiscriminatorValue("MACROSCOP")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class MacroscopImgPlace extends ImgPlace {
    @OneToOne(optional = true, fetch = FetchType.LAZY)
    @JoinColumn(
            name = "macroscop_channel_id", referencedColumnName = "id", nullable = true,
            foreignKey = @ForeignKey(name = "fk_macroscop_img_places_channel", value = ConstraintMode.CONSTRAINT)
    )
    private MacroscopChannel channel;

    @Column(name = "macroscop_internal_id", nullable = false)
    private String origChannelId;


    @Override
    public String getInternalName() {
        return channel == null ? null : channel.getName();
    }
}
