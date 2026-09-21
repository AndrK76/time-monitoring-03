package ru.igorit.monitoring.lib.persistence.entity.evt;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "evt_places")
@Inheritance(strategy = InheritanceType.SINGLE_TABLE)
@DiscriminatorColumn(name = "type_discriminator", discriminatorType = DiscriminatorType.STRING, length = 255)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public abstract class EvtPlace {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(length = 255)
    private String id;

    @Column(name = "name",nullable = false, length = 2000)
    private String name;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agent_id", nullable = false)
    private EvtAgent agent;

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

    @Column(name = "available", nullable = false)
    private Boolean available;
}
