package ru.igorit.monitoring.admin.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import ru.igorit.monitoring.admin.mapper.CrmModelMapper;
import ru.igorit.monitoring.admin.mapper.EventCommandMapper;
import ru.igorit.monitoring.common.dto.command.auth.OrganizationInfoChangedEventCommandDto;
import ru.igorit.monitoring.common.enums.command.CommandMessageType;
import ru.igorit.monitoring.lib.dto.crm.CrmAgentConfigDto;
import ru.igorit.monitoring.lib.dto.crm.CrmAgentItemDto;
import ru.igorit.monitoring.lib.dto.crm.CrmAgentListDto;
import ru.igorit.monitoring.lib.dto.crm.CrmAgentTypeDto;
import ru.igorit.monitoring.lib.enums.CrmAgentType;
import ru.igorit.monitoring.lib.persistence.entity.common.Organization;
import ru.igorit.monitoring.lib.persistence.entity.crm.CrmAgent;
import ru.igorit.monitoring.lib.persistence.entity.crm.CrmAgentConfig;
import ru.igorit.monitoring.lib.persistence.entity.crm.CrmOrganization;
import ru.igorit.monitoring.lib.persistence.entity.yclients.YClientsAgent;
import ru.igorit.monitoring.lib.persistence.entity.yclients.YClientsAgentConfig;
import ru.igorit.monitoring.lib.persistence.entity.yclients.YClientsOrganization;
import ru.igorit.monitoring.lib.persistence.repository.common.OrganizationRepository;
import ru.igorit.monitoring.lib.persistence.repository.crm.CrmAgentConfigRepository;
import ru.igorit.monitoring.lib.persistence.repository.crm.CrmAgentRepository;
import ru.igorit.monitoring.lib.persistence.repository.crm.CrmOrganizationRepository;
import ru.igorit.monitoring.rabbit.service.CommandSender;
import ru.igorit.monitoring.security.util.SecurityAccessUtils;

import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

import static ru.igorit.monitoring.security.util.AuthInfoUtils.extractUserId;
import static ru.igorit.monitoring.security.util.AuthInfoUtils.getCurrentAuth;

@Service
@RequiredArgsConstructor
@Log4j2
public class CrmManageService {
    private final CrmModelMapper crmModelMapper;
    private final CrmAgentRepository agentRepo;
    private final CrmOrganizationRepository orgRepo;
    private final CrmAgentConfigRepository cfgRepo;
    private final OrganizationRepository commonOrgRepo;
    private final SecurityAccessUtils sa;
    private final CommandSender commandSender;
    private final EventCommandMapper eventCommandMapper;

    public List<CrmAgentTypeDto> getAgentTypes() {
        return Arrays.stream(CrmAgentType.values()).map(crmModelMapper::toDto).toList();
    }

    @Transactional(readOnly = true)
    @PreAuthorize("@securityAccessUtils.isAllowedAllActions()")
    public List<CrmAgentListDto> getAllAgents() {
        return agentRepo.findAllProjectedBy().stream()
                .map(crmModelMapper::toListDto)
                .filter(f -> sa.isSuperUser() || sa.isAllowedOrganization(f.getOrganizationId()))
                .toList();
    }

    @Transactional(readOnly = true)
    @PreAuthorize("@securityAccessUtils.isAllowedOrganization(#organizationId)")
    public List<CrmAgentListDto> getAgentsByOrganization(String organizationId) {
        return agentRepo.findProjectedByOrganizationId(organizationId).stream()
                .map(crmModelMapper::toListDto).toList();
    }

    @Transactional(readOnly = true)
    @PreAuthorize("@securityAccessUtils.isSuperUser()")
    public List<CrmAgentListDto> getAgentsByOrganizationWithUnbounded(String organizationId) {
        return agentRepo.findAllProjectedBy().stream()
                .filter(f -> f.getOrganization() == null || Objects.equals(f.getOrganization().getId(), organizationId))
                .map(crmModelMapper::toListDto).toList();
    }

    @Transactional(readOnly = true)
    @PreAuthorize("@securityAccessUtils.isAllowedAllActions()")
    public CrmAgentItemDto getAgent(String agentId) {
        var stored = agentRepo.findById(agentId).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "CRM Agent with id " + agentId + " not found"));
        var ret = crmModelMapper.toDto(stored);
        if (!(sa.isAllowedAllOrganizations() || sa.isAllowedOrganization(ret.getOrganizationId()))) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "CRM Agent with id " + agentId + " not found");
        }
        return ret;
    }

    @Transactional
    @PreAuthorize("@securityAccessUtils.isSuperUser()")
    public CrmAgentItemDto addAgent(CrmAgentListDto dto) {
        var agentType = Optional.ofNullable(CrmAgentType.byId(dto.getAgentType())).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Not known CRM agent type"));
        if (dto.getOrganizationId() != null && !(agentRepo.findByOrganizationId(dto.getOrganizationId()).isEmpty())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Crm agent for organization " + dto.getOrganizationId() + " already exists");
        }
        var org = dto.getOrganizationId() == null ? null :
                commonOrgRepo.findById(dto.getOrganizationId()).orElseThrow(
                        () -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Not exists organization"));
        var crmOrg = new CrmOrganization();
        crmOrg.setCreatedBy(extractUserId(getCurrentAuth()));
        var agent = CrmAgent.builder()
                .type(agentType)
                .name(dto.getName())
                .description(dto.getDescription())
                .configured(false)
                .createdBy(extractUserId(getCurrentAuth()))
                .build();
        switch (agentType) {
            case YClients -> {
                crmOrg = orgRepo.save(new YClientsOrganization(crmOrg));
                agent = new YClientsAgent(agent);
            }
            default ->
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported CRM agent type: " + agentType);
        }
        agent.setCrmOrganization(crmOrg);
        agent.setOrganization(org);
        var stored = agentRepo.save(agent);
        if (org != null) {
            org.setUpdatedBy(extractUserId(getCurrentAuth()));
            commonOrgRepo.save(org);
        }
        return crmModelMapper.toDto(stored);
    }

    @Transactional
    @PreAuthorize("@securityAccessUtils.isAllowedAllActions()")
    public CrmAgentItemDto updateAgent(String agentId, CrmAgentItemDto dto) {
        if (dto == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request data for CRM Agent is empty");
        }
        if (!agentId.equalsIgnoreCase(dto.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request Id not equal CRM Agent id=" + dto.getId());
        }
        var stored = agentRepo.findById(agentId).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "CRM Agent with id " + agentId + " not found"));
        String storedOrgId = Optional.ofNullable(stored.getOrganization()).map(Organization::getId).orElse(null);
        if (!(sa.isAllowedAllOrganizations() || sa.isAllowedOrganization(storedOrgId))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "CRM Agent with id " + agentId + " not allowed for change");
        }
        var changeOrg = !Objects.equals(storedOrgId, dto.getOrganizationId());
        if (changeOrg && !sa.isSuperUser()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "CRM Agent organization binding not allowed");
        }
        if (!Objects.equals(stored.getName(), dto.getName())) {
            stored.setName(dto.getName());
        }
        if (!Objects.equals(stored.getDescription(), dto.getDescription())) {
            stored.setDescription(dto.getDescription());
        }
        stored.setUpdatedBy(extractUserId(getCurrentAuth()));
        stored = agentRepo.saveAndFlush(stored);
        if (changeOrg && dto.getOrganizationId() != null) {
            stored = _bindAgent(stored.getId(), dto.getOrganizationId());
        } else if (changeOrg) {
            stored = _unbindAgent(stored.getId());
        }
        return crmModelMapper.toDto(stored);
    }

    @Transactional
    @PreAuthorize("@securityAccessUtils.isSuperUser()")
    public void deleteAgent(String agentId) {
        var curr = agentRepo.findById(agentId).orElse(null);
        String orgId = curr == null ? null : curr.getCrmOrganization().getId();
        if (curr!= null && curr.getOrganization() != null) {
            _unbindAgent(agentId);
        }
        agentRepo.deleteById(agentId);
        if (orgId != null) {
            orgRepo.deleteById(orgId);
        }
    }


    @Transactional
    @PreAuthorize("@securityAccessUtils.isSuperUser()")
    public CrmAgentItemDto unbindAgent(String agentId) {
        return crmModelMapper.toDto(_unbindAgent(agentId));
    }

    @Transactional
    @PreAuthorize("@securityAccessUtils.isSuperUser()")
    public CrmAgentItemDto bindAgent(String agentId, String orgId) {
        return crmModelMapper.toDto(_bindAgent(agentId, orgId));
    }

    @Transactional
    @PreAuthorize("@securityAccessUtils.isAllowedAllActions()")
    public CrmAgentConfigDto getAgentConfig(String agentId) {
        getAgent(agentId);
        var agent = agentRepo.findById(agentId).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "CRM Agent with id " + agentId + " not found"));
        var config = agent.getConfig();
        if (config == null) {
            switch (agent.getType()) {
                case YClients -> {
                    config = new YClientsAgentConfig(agent);
                    config.setCreatedBy(extractUserId(getCurrentAuth()));
                    config = cfgRepo.saveAndFlush(config);
                    agent.setConfig(config);
                    agent.setCreatedBy(extractUserId(getCurrentAuth()));
                    agentRepo.save(agent);
                }
                default ->
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported CRM agent type: " + agent.getType());
            }
        }
        return crmModelMapper.toDto(config);
    }


    private CrmAgent _unbindAgent(String agentId) {
        var stored = agentRepo.findById(agentId).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "CRM Agent with id " + agentId + " not found"));
        var currOrg = stored.getOrganization();
        stored.setOrganization(null);
        stored.setUpdatedBy(extractUserId(getCurrentAuth()));
        var ret = agentRepo.save(stored);
        if (currOrg != null) {
            currOrg.setUpdatedBy(extractUserId(getCurrentAuth()));
            currOrg = commonOrgRepo.save(currOrg);
            sendOrgChangeEvent(currOrg);
        }
        return ret;
    }

    public CrmAgent _bindAgent(String agentId, String orgId) {
        var stored = agentRepo.findById(agentId).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "CRM Agent with id " + agentId + " not found"));
        var currOrg = stored.getOrganization();
        if (currOrg != null) {
            stored.setOrganization(null);
            currOrg.setUpdatedBy(extractUserId(getCurrentAuth()));
            currOrg = commonOrgRepo.saveAndFlush(currOrg);
            sendOrgChangeEvent(currOrg);
        }
        var newOrg = commonOrgRepo.findById(orgId).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organization with id " + orgId + " not found"));
        var newOrgAgent = agentRepo.findByOrganizationId(newOrg.getId());
        if (!newOrgAgent.isEmpty()) {
            newOrgAgent.get(0).setOrganization(null);
            newOrgAgent.get(0).setUpdatedBy(extractUserId(getCurrentAuth()));
            agentRepo.saveAndFlush(newOrgAgent.get(0));
        }
        stored.setOrganization(newOrg);
        newOrg.setUpdatedBy(extractUserId(getCurrentAuth()));
        newOrg = commonOrgRepo.save(newOrg);
        sendOrgChangeEvent(newOrg);
        stored.setUpdatedBy(extractUserId(getCurrentAuth()));
        return agentRepo.save(stored);
    }


    private void sendOrgChangeEvent(Organization organization) {
        var targets = List.of(commandSender.getConfig().getMonServerRoute());
        OrganizationInfoChangedEventCommandDto event = eventCommandMapper.toOrgChangeEvent(organization);
        event.setMode(OrganizationInfoChangedEventCommandDto.Mode.UPDATE_CRM_BIND);
        targets.forEach(target -> {
            try {
                commandSender.sendCommandToInternal(target,
                        CommandMessageType.ORGANIZATION_INFO_CHANGED, event);
                log.info("Organization {} event sent for organization: {}", event.getMode(), event.getOrgId());
            } catch (Exception e) {
                log.info("Failed to send organization {} event sent for organization: {}", event.getMode(), event.getOrgId());
            }
        });
    }

}
