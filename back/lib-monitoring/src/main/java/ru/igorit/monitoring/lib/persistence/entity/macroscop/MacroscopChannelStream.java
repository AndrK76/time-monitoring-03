package ru.igorit.monitoring.lib.persistence.entity.macroscop;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class MacroscopChannelStream {

    @Column(name = "stream_type", length = 255)
    private String type;

    @Column(name = "stream_format", length = 255)
    private String format;
}