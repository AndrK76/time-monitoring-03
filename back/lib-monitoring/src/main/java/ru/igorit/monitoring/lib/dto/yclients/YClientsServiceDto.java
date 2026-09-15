package ru.igorit.monitoring.lib.dto.yclients;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class YClientsServiceDto {
    private String id;
    private String name;
    @NotNull
    private long ycId;
    @NotBlank
    private String ycName;
    @NotNull
    private long categoryId;
}
