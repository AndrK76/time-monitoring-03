package ru.igorit.monitoring.lib.persistence.entity.crm;

import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "crm_organizations")
@Inheritance(strategy = InheritanceType.SINGLE_TABLE)
@DiscriminatorColumn(name = "type_discriminator", discriminatorType = DiscriminatorType.STRING, length = 255)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CrmOrganization {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(length = 255)
    private String id;

    @OneToMany(mappedBy = "organization", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<CrmPlace> places = new ArrayList<>();

    @OneToOne(mappedBy = "crmOrganization")
    private CrmAgent agent;

    public void addPlace(CrmPlace place) {
        places.add(place);
        place.setOrganization(this);
    }

    public void removePlace(CrmPlace place) {
        places.remove(place);
        place.setOrganization(null);
    }

    public String getName() {
        return null;
    }

}
