package ru.igorit.monitoring.lib.persistence.entity.yclients;

import jakarta.persistence.*;
import lombok.*;
import ru.igorit.monitoring.lib.enums.CrmAgentType;
import ru.igorit.monitoring.lib.persistence.entity.crm.CrmAgent;

import java.util.ArrayList;
import java.util.List;

@Entity
@DiscriminatorValue("YCLIENTS")
@Getter
@Setter
public class YClientsAgent extends CrmAgent {

    @OneToMany(mappedBy = "agent", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<YClientsServiceCategory> serviceCategories = new ArrayList<>();

    public YClientsAgent() {
        super.setType(CrmAgentType.YClients);
    }

    public YClientsAgent(CrmAgent agent) {
        super();
        if (agent != null) {
            super.setType(CrmAgentType.YClients);
            this.setId(agent.getId());
            this.setOrganization(agent.getOrganization());
            this.setType(agent.getType());
            this.setName(agent.getName());
            this.setDescription(agent.getDescription());
            this.setConfigured(agent.isConfigured());
            this.setConfig(agent.getConfig());
            this.setCrmOrganization(agent.getCrmOrganization());
            if (agent.getServices() != null) {
                this.setServices(new ArrayList<>(agent.getServices()));
            }
            this.setCreatedBy(agent.getCreatedBy());
        }
    }


}