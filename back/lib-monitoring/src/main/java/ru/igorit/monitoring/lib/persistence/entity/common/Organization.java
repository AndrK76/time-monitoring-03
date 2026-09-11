package ru.igorit.monitoring.lib.persistence.entity.common;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.BatchSize;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import ru.igorit.monitoring.persistence.entity.admin.UserOrganization;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "organizations")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Organization {

    @Id
    private String id;

    @Column(nullable = false, name = "short_name", length = 40)
    private String shortName;

    @Column(nullable = false, name = "full_name")
    private String fullName;

    @Column(name = "crm_agent_set", nullable = false)
    private boolean crmAgentSet;

    @Column(name = "events_agents_set", nullable = false)
    private boolean eventAgentsSet;

    @Column(name = "camera_agents_set", nullable = false)
    private boolean cameraAgentsSet;

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


    public Organization(String id) {
        this.id = id;
    }



}