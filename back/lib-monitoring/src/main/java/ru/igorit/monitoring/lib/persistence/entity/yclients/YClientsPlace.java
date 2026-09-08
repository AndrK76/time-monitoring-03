package ru.igorit.monitoring.lib.persistence.entity.yclients;

import jakarta.persistence.Column;
import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.Entity;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import ru.igorit.monitoring.lib.persistence.entity.crm.CrmPlace;

@Entity
@DiscriminatorValue("YCLIENTS")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class YClientsPlace extends CrmPlace {
    @Column(name="yc_id",unique = true, nullable = false)
    private long yclientsId;
    @Column(name="yc_name", length = 2000)
    private String yclientsName;
}
