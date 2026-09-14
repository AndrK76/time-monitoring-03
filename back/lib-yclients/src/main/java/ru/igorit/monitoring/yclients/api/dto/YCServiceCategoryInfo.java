package ru.igorit.monitoring.yclients.api.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class YCServiceCategoryInfo {
    private int id;
    private String title;
    private List<Integer> staff;
}
