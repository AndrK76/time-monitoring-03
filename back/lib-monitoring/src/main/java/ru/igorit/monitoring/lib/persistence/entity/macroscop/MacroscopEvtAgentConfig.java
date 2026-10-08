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
    public static int DEFAULT_SEARCH_DEPTH_IN_HOURS = 24;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "config_id", nullable = true)
    private MacroscopAgentConfig config;

    @Enumerated(EnumType.STRING)
    @Column(name="event_mode")
    private MacroscopEvtAgentMode mode;

    @Column(name = "search_depth_hours")
    private Integer searchPlaceDepthInHours;

    public MacroscopEvtAgentConfig(EvtAgent agent) {
        super();
        if (agent != null) {
            this.setAgent(agent);
            agent.setConfig(this);
        }
        this.setSearchPlaceDepthInHours(DEFAULT_SEARCH_DEPTH_IN_HOURS);
        this.setMode(MacroscopEvtAgentMode.unknown);
    }

}