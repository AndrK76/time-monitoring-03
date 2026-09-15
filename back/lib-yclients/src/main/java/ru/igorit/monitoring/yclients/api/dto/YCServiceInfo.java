package ru.igorit.monitoring.yclients.api.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@ToString(of = {"id","title","category_id"})
public class YCServiceInfo {
    private int id;
    private int category_id;
    private String title;
    private Integer active;
    private boolean is_online;
}
