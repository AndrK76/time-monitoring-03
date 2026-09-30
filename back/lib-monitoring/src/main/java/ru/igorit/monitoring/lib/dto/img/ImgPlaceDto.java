package ru.igorit.monitoring.lib.dto.img;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ImgPlaceDto {
    private String id;
    private String type;
    private String name;
    private String internalName;
    private boolean used;
    private boolean actual;
    private boolean present;
    private boolean deleted;

}
