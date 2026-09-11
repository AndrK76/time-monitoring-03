package ru.igorit.monitoring.yclients.api.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.http.HttpStatusCode;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class YCResponse<TData, TMeta> {
    private HttpStatusCode status;
    private boolean success;
    private TData data;
    private TMeta meta;

}
