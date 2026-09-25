package ru.igorit.monitoring.lib.persistence.entity.macroscop;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class MacroscopServerInfo {

    @Column(name = "server_id", length = 255)
    private String id;

    @Column(name = "server_version", length = 64)
    private String version;

    @Column(name = "info_response_time")
    private OffsetDateTime responseDate;

    @Column(name = "server_tz", length = 16)
    private String tz;

    @Column(name = "server_use_tz")
    private Boolean useTz;

    public void fillFrom(MacroscopServerInfo other) {
        this.id = other.id;
        this.version = other.version;
        this.responseDate = other.responseDate;
        this.tz = other.tz;
        this.useTz = other.useTz;
    }

    public boolean isEmpty() {
        return id == null && version == null
                && responseDate == null && tz == null && useTz == null;
    }
}