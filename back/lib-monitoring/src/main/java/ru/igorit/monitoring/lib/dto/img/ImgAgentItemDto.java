package ru.igorit.monitoring.lib.dto.img;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ImgAgentItemDto {
    private String id;
    private String organizationId;
    private String agentType;
    private String name;
    private String description;
    private boolean configured;
    private ImgAgentConfigDto config;
    private List<ImgPlaceListDto> places;
}
