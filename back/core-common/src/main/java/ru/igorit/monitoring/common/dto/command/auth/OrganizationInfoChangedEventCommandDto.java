package ru.igorit.monitoring.common.dto.command.auth;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrganizationInfoChangedEventCommandDto implements Serializable {
    @Serial
    private static final long serialVersionUID = 1L;

    private String orgId;
    private Mode mode;
    private String shortName;
    private String fullName;
    private LocalDateTime updatedAt;
    private String updatedBy;
    private String[] users;

    public static OrganizationInfoChangedEventCommandDto newDeleteEvent(String orgId) {
        return builder().orgId(orgId).mode(Mode.DELETE).build();
    }

    @Override
    public String toString() {
        return "{" +
                "orgId='" + orgId + '\'' +
                ", mode=" + mode +
                '}';
    }

    public enum Mode {
        DELETE,
        ADD,
        UPDATE
    }


}
