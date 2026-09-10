package ru.igorit.monitoring.lib.persistence.entity.yclients;

import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.PostLoad;
import jakarta.persistence.Table;
import lombok.*;
import ru.igorit.monitoring.lib.persistence.entity.crm.CrmAgent;
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

    public YClientsAgentConfig(CrmAgent agent) {
        super();
        if (agent != null) {
            this.setAgent(agent);
            agent.setConfig(this);
        }
    }

    @PostLoad
    private void ensureCredentials() {
        if (this.credentials == null) {
            this.credentials = new YClientCredentials();
        }
    }
}