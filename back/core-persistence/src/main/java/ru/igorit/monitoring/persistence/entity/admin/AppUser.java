package ru.igorit.monitoring.persistence.entity.admin;

import jakarta.persistence.*;
import lombok.*;

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