package ru.igorit.monitoring.lib.persistence.entity.yclients;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "yc_service_categories")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class YClientsServiceCategory {
    @Id
    @Column(name = "yc_id")
    private long yClientsId;
    @Column(name = "yc_name", length = 2000)
    private String yClientsName;

    @ManyToOne
    @JoinColumn(name = "agent_id")
    private YClientsAgent agent;

    @ManyToOne
    @JoinColumn(name = "organization_id")
    private YClientsOrganization organization;

    @OneToMany(mappedBy = "serviceCategory")
    private List<YClientsService> services = new ArrayList<>();

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
}
