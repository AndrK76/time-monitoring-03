package ru.igorit.monitoring.persistence.entity.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.*;

@Entity
@Table(name = "organizations")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuthOrganization {

    @Id
    private String id;

    @Column(nullable = false, name = "short_name", length = 40)
    private String shortName;

    @Column(nullable = false, name = "full_name")
    private String fullName;

    public AuthOrganization(String id) {
        this.id = id;
    }




}