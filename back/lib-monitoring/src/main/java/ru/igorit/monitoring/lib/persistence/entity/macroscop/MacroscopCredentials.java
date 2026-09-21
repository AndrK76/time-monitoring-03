package ru.igorit.monitoring.lib.persistence.entity.macroscop;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Embeddable
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class MacroscopCredentials {
    @Column(name = "login", length = 255)
    private String login;
    @Column(name = "password", length = 255)
    private String password;

    public void fillFrom(MacroscopCredentials other) {
        this.login = other.login;
        this.password = other.password;
    }
}