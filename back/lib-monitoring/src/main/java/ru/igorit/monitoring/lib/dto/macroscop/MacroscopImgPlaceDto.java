package ru.igorit.monitoring.lib.dto.macroscop;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MacroscopImgPlaceDto {
    private String id;
    private String type;
    private String name;
    private String internalName;
    private boolean used;
    private boolean actual;
    private boolean present;
    private boolean deleted;
    @NotBlank
    private String macroscopId;
    @NotBlank
    private String channelId;
}
