package ru.igorit.monitoring.lib.persistence.entity.macroscop;

import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.Entity;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;
import ru.igorit.monitoring.lib.enums.EvtAgentType;
import ru.igorit.monitoring.lib.persistence.entity.evt.EvtAgent;

import java.util.ArrayList;

@Entity
@DiscriminatorValue("MACROSCOP")
@Getter
@Setter
@Builder
public class MacroscopEvtAgent extends EvtAgent {


    public MacroscopEvtAgent() {
        super.setType(EvtAgentType.Macroscop);
        super.setPlaces(new ArrayList<>());
    }

    public MacroscopEvtAgent(EvtAgent agent) {
        super();
        if (agent != null) {
            super.setType(EvtAgentType.Macroscop);
            this.setId(agent.getId());
            this.setOrganization(agent.getOrganization());
            this.setType(agent.getType());
            this.setName(agent.getName());
            this.setDescription(agent.getDescription());
            this.setConfigured(agent.isConfigured());
            this.setConfig(agent.getConfig());
            if (agent.getPlaces() != null) {
                this.setPlaces(new ArrayList<>(agent.getPlaces()));
            }
            this.setCreatedBy(agent.getCreatedBy());
        }
    }


}