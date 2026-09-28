package ru.igorit.monitoring.common.dto.common;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BinaryContent {
    private byte[] data;
    private String contentType;
}
