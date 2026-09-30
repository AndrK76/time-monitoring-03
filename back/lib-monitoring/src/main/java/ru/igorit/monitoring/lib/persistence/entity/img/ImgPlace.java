package ru.igorit.monitoring.lib.persistence.entity.img;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import ru.igorit.monitoring.lib.enums.ImgAgentType;

import java.time.LocalDateTime;

@Entity
@Table(name = "img_places")
@Inheritance(strategy = InheritanceType.SINGLE_TABLE)
@DiscriminatorColumn(name = "type_discriminator", discriminatorType = DiscriminatorType.STRING, length = 255)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public abstract class ImgPlace {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(length = 255)
    private String id;

    @Column(name = "name",nullable = false, length = 2000)
    private String name;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agent_id", nullable = false)
    private ImgAgent agent;

    @Column(name = "used", nullable = false)
    private Boolean used;

    @Column(name = "present", nullable = false)
    private Boolean present = true;

    @Column(name = "deleted", nullable = false)
    private Boolean deleted = false;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "created_by")
    private String createdBy;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "updated_by")
    private String updatedBy;

    @Transient
    public ImgAgentType getType() {
        DiscriminatorValue dv = getClass().getAnnotation(DiscriminatorValue.class);
        return dv == null ? null : ImgAgentType.byDiscriminator(dv.value());
    }

    public boolean isActual(){
        return Boolean.TRUE.equals(this.present) && !Boolean.TRUE.equals(this.deleted);
    }

    public abstract String getInternalName();
}
