package ru.igorit.monitoring.lib.persistence.entity.evt;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.BatchSize;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import ru.igorit.monitoring.lib.enums.EvtAgentType;
import ru.igorit.monitoring.lib.persistence.entity.common.Organization;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "evt_agents")
@Inheritance(strategy = InheritanceType.SINGLE_TABLE)
@DiscriminatorColumn(name = "type_discriminator", discriminatorType = DiscriminatorType.STRING, length = 255)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class EvtAgent {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(length = 255)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id")
    private Organization organization;

    @Column(name = "agent_type", nullable = false, length = 255)
    @Enumerated(EnumType.STRING)
    private EvtAgentType type;

    @Column(name = "name", nullable = false, length = 2000)
    private String name;

    @Column(name = "description", length = Integer.MAX_VALUE)
    private String description;

    @Column(name = "is_configured", nullable = false)
    private boolean configured;

    @OneToOne(mappedBy = "agent", cascade = CascadeType.ALL, optional = true)
    private EvtAgentConfig config;

    @BatchSize(size = 40)
    @OneToMany(mappedBy = "agent", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<EvtPlace> places = new ArrayList<>();


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

    public void setConfig(EvtAgentConfig config) {
        this.config = config;
        if (config != null) {
            this.configured = true;
            config.setAgent(this);
        } else {
            this.configured = false;
        }
    }


    public void setOrganization(Organization organization) {
        if (organization != null) {
            organization.setEventAgentsSet(true);
        }
        this.organization = organization;
    }

}
