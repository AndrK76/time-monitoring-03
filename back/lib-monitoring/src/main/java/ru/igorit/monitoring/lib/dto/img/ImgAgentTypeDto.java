package ru.igorit.monitoring.lib.dto.img;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ImgAgentTypeDto {
    private String value;
    private String name;
    private String description;
}
