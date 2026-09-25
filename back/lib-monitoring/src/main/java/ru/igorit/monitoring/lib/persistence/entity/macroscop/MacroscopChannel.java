package ru.igorit.monitoring.lib.persistence.entity.macroscop;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;

@Entity
@Table(
        name = "macroscop_agent_channels",
        indexes = {
                @Index(name = "ix_macroscop_channel_config", columnList = "config_id"),
                @Index(name = "ix_macroscop_channel_uid", columnList = "config_id,macroscop_id", unique = true)
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class MacroscopChannel {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(length = 255)
    private String id;

    @Column(length = 255, nullable = false, name="channel_id")
    private String macroscopId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "config_id", nullable = false)
    private MacroscopAgentConfig config;

    @Column(name = "channel_name", length = 255)
    private String name;

    @Column(name = "device", length = 255)
    private String device;

    @Column(name = "enabled", nullable = false)
    private Boolean enabled;

    @Column(name = "exists_on_server", nullable = false)
    private Boolean exists;

    @Column(name = "use_channel", nullable = false)
    private Boolean used = true;

    @Column(name = "archive_on", nullable = false)
    private Boolean archivingEnabled;

    @Column(name = "archive_allow", nullable = false)
    private Boolean archiveAllowed;

    @Column(name = "realtime_allow", nullable = false)
    private Boolean realtimeAllowed;

    @Column(name = "sound_allow", nullable = false)
    private Boolean soundAllowed;

    @Enumerated(EnumType.STRING)
    @Column(name = "archive_mode")
    private MacroscopArchiveMode archiveMode;

    @Column(name = "channel_tz", length = 16)
    private String tz;

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
