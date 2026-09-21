package ru.igorit.monitoring.lib.persistence.entity.macroscop;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "macroscop_agent_configs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class MacroscopAgentConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(length = 255)
    private String id;

    @Column(name = "name", nullable = false, length = 255)
    private String name;

    @Column(name = "address", length = 255)
    private String serverAddress;

    @Embedded
    private MacroscopCredentials credentials;

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


    @PostLoad
    private void ensureCredentials() {
        if (this.credentials == null) {
            this.credentials = new MacroscopCredentials();
        }
    }
}