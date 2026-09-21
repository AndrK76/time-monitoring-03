package ru.igorit.monitoring.lib.persistence.entity.macroscop;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import ru.igorit.monitoring.lib.persistence.entity.evt.EvtAgent;
import ru.igorit.monitoring.lib.persistence.entity.evt.EvtAgentConfig;

@Entity
@Table(name = "macroscop_evt_agent_configs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class MacroscopEvtAgentConfig extends EvtAgentConfig {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "config_id", nullable = true)
    private MacroscopAgentConfig config;

    public MacroscopEvtAgentConfig(EvtAgent agent) {
        super();
        if (agent != null) {
            this.setAgent(agent);
            agent.setConfig(this);
        }
    }

}