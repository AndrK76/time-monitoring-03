package ru.igorit.monitoring.lib.persistence.entity.macroscop;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import ru.igorit.monitoring.lib.persistence.entity.evt.EvtAgent;
import ru.igorit.monitoring.lib.persistence.entity.evt.EvtAgentConfig;
import ru.igorit.monitoring.lib.persistence.entity.img.ImgAgent;
import ru.igorit.monitoring.lib.persistence.entity.img.ImgAgentConfig;

@Entity
@Table(name = "macroscop_img_agent_configs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class MacroscopImgAgentConfig extends ImgAgentConfig {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "config_id", nullable = true)
    private MacroscopAgentConfig config;

    public MacroscopImgAgentConfig(ImgAgent agent) {
        super();
        if (agent != null) {
            this.setAgent(agent);
            agent.setConfig(this);
        }
    }

}