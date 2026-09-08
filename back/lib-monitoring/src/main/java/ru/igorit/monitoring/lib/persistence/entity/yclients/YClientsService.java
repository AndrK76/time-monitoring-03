package ru.igorit.monitoring.lib.persistence.entity.yclients;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import ru.igorit.monitoring.lib.persistence.entity.crm.CrmService;

@Entity
@DiscriminatorValue("YCLIENTS")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class YClientsService extends CrmService {
    @Column(name = "yc_id", unique = true, nullable = false)
    private long yClientsId;
    @Column(name = "yc_name", length = 2000)
    private String yClientsName;

    @ManyToOne
    @JoinColumn(name = "service_category_id")
    private YClientsServiceCategory serviceCategory;
}
