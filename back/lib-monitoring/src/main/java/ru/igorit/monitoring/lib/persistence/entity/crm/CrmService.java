package ru.igorit.monitoring.lib.persistence.entity.crm;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "crm_services")
@Inheritance(strategy = InheritanceType.SINGLE_TABLE)
@DiscriminatorColumn(name = "type_discriminator", discriminatorType = DiscriminatorType.STRING, length = 255)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CrmService {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(length = 255)
    private String id;

    @Column(name="name", nullable=false, length=2000)
    private String name;

    @ManyToOne
    @JoinColumn(name = "agent_id")
    private CrmAgent agent;
}
