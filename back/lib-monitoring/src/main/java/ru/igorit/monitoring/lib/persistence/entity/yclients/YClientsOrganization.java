package ru.igorit.monitoring.lib.persistence.entity.yclients;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import ru.igorit.monitoring.lib.persistence.entity.crm.CrmOrganization;

import java.util.ArrayList;
import java.util.List;

@Entity
@DiscriminatorValue("YCLIENTS")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class YClientsOrganization extends CrmOrganization {


    @Column(name = "yc_id", unique = true, nullable = false)
    private Long yclientsId;


    @Column(name = "yc_name", length = 2000)
    private String yclientsName;

    @Column(name = "yc_tz")
    private String yclientsTimezone;

    @OneToMany(mappedBy = "organization", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<YClientsServiceCategory> serviceCategories = new ArrayList<>();

    @Override
    public String getName() {
        return this.yclientsName;
    }

    @Override
    public String getTimeZone() {
        return this.yclientsTimezone;
    }

    public YClientsOrganization(CrmOrganization org) {
        super();
        if (org != null) {
            this.setAgent(org.getAgent());
            if (org.getPlaces() != null) {
                this.setPlaces(org.getPlaces());
            }
            this.setCreatedBy(org.getCreatedBy());
        }
    }
}
