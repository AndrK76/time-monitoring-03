package ru.igorit.monitoring.lib.persistence.entity.yclients;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

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
}
