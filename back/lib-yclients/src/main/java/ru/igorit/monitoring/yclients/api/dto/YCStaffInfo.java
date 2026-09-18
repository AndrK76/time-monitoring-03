package ru.igorit.monitoring.yclients.api.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class YCStaffInfo {
    private int id;
    private String name;
    private Integer fired;
    private Integer status;
}
