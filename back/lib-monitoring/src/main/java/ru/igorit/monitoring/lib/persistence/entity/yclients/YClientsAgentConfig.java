package ru.igorit.monitoring.lib.persistence.entity.yclients;

import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.*;
import ru.igorit.monitoring.lib.persistence.entity.crm.CrmAgentConfig;

@Entity
@Table(name = "yc_agent_configs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class YClientsAgentConfig extends CrmAgentConfig {

    @Embedded
    private YClientCredentials credentials;
}