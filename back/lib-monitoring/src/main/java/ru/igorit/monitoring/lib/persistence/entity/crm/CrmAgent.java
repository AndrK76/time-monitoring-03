package ru.igorit.monitoring.lib.persistence.entity.crm;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.BatchSize;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import ru.igorit.monitoring.lib.enums.CrmAgentType;
import ru.igorit.monitoring.lib.persistence.entity.common.Organization;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "crm_agents")
@Inheritance(strategy = InheritanceType.SINGLE_TABLE)
@DiscriminatorColumn(name = "type_discriminator", discriminatorType = DiscriminatorType.STRING, length = 255)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CrmAgent {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(length = 255)
    private String id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", unique = true)
    private Organization organization;

    @Column(name = "agent_type", nullable = false, length = 255)
    @Enumerated(EnumType.STRING)
    private CrmAgentType type;

    @Column(name = "name", nullable = false, length = 2000)
    private String name;

    @Column(name = "description", length = Integer.MAX_VALUE)
    private String description;

    @Column(name = "is_configured", nullable = false)
    private boolean configured;

    @OneToOne(mappedBy = "agent", cascade = CascadeType.ALL, optional = true)
    private CrmAgentConfig config;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "crm_organization_id", unique = true)
    private CrmOrganization crmOrganization;

    @BatchSize(size = 40)
    @OneToMany(mappedBy = "agent", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<CrmService> services = new ArrayList<>();


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

    public void setConfig(CrmAgentConfig config) {
        this.config = config;
        if (config != null) {
            this.configured = true;
            config.setAgent(this);
        } else {
            this.configured = false;
        }
    }

    public void addService(CrmService service) {
        services.add(service);
        service.setAgent(this);
    }

    public void removeService(CrmService service) {
        services.remove(service);
        service.setAgent(null);
    }

    public void setOrganization(Organization organization) {
        if (organization != null) {
            organization.setCrmAgentSet(true);
        } else if (this.organization != null) {
            this.organization.setCrmAgentSet(false);
        }
        this.organization = organization;
    }

}
