package ru.igorit.monitoring.lib.persistence.entity.macroscop;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;

@Entity
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Table(name = "macroscop_event_types", indexes = {
        @Index(name = "ix_macroscop_event_types_evt_type", columnList = "evt_type", unique = true)})
public class MacroscopEventType {

    @Id
    @Column(name = "id", length = 255)
    String id;

    @Column(name = "name", length = 255)
    private String name;

    @Column(name = "evt_type", length = 255)
    @Enumerated(EnumType.STRING)
    private MacroscopActivityEventType type;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "created_by")
    private String createdBy;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    @Column(name = "updated_by")
    private String updatedBy;
}