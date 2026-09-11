package ru.igorit.monitoring.bl.model.yclients.api;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.http.HttpStatusCode;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class YCResponse {
    private HttpStatusCode status;
    private boolean success;
    private Object data;
    private Object meta;

}
