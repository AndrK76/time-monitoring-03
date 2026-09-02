package ru.igorit.monitoring.persistence.entity.admin;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.BatchSize;
import ru.igorit.monitoring.persistence.entity.auth.Permission;

import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "app_users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AppUser implements Cloneable {

    @Id
    private String id;

    @Column(nullable = false, unique = true)
    private String username;

    @Column(name = "display_name")
    private String displayName;

    @Column(name = "is_valid")
    private boolean valid;

    @Column(length = Integer.MAX_VALUE)
    private String roles;

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    @BatchSize(size = 40)
    private Set<UserOrganization> organizations = new HashSet<>();


    @Override
    public AppUser clone() {
        try {
            return (AppUser) super.clone();
        } catch (CloneNotSupportedException e) {
            throw new AssertionError();
        }
    }

    public void fillFrom(AppUser src) {
        if (src == null) {
            return;
        }
        setUsername(src.getUsername());
        setDisplayName(src.getDisplayName());
        setValid(src.isValid());
        setRoles(src.getRoles());
    }
}