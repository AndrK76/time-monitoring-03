package ru.igorit.monitoring.bl.model.yclients.api;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class YCOrgInfo {
    private int id;
    private String title;
    @JsonProperty("public_title")
    private String publicTitle;
    @JsonProperty("short_descr")
    private String shortDescr;
    private Integer timezone;
    @JsonProperty("timezone_name")
    private String timezoneName;
}
