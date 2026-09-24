package ru.igorit.monitoring.admin.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import ru.igorit.monitoring.admin.mapper.EventCommandMapper;
import ru.igorit.monitoring.admin.mapper.EvtModelMapper;
import ru.igorit.monitoring.common.dto.command.auth.OrganizationInfoChangedEventCommandDto;
import ru.igorit.monitoring.common.enums.command.CommandMessageType;
import ru.igorit.monitoring.lib.dto.evt.EvtAgentConfigDto;
import ru.igorit.monitoring.lib.dto.evt.EvtAgentItemDto;
import ru.igorit.monitoring.lib.dto.evt.EvtAgentListDto;
import ru.igorit.monitoring.lib.dto.evt.EvtAgentTypeDto;
import ru.igorit.monitoring.lib.enums.EvtAgentType;
import ru.igorit.monitoring.lib.persistence.entity.common.Organization;
import ru.igorit.monitoring.lib.persistence.entity.crm.EvtAgentListProjection;
import ru.igorit.monitoring.lib.persistence.entity.evt.EvtAgent;
import ru.igorit.monitoring.lib.persistence.entity.macroscop.MacroscopEvtAgent;
import ru.igorit.monitoring.lib.persistence.entity.macroscop.MacroscopEvtAgentConfig;
import ru.igorit.monitoring.lib.persistence.repository.common.OrganizationRepository;
import ru.igorit.monitoring.lib.persistence.repository.evt.EvtAgentConfigRepository;
import ru.igorit.monitoring.lib.persistence.repository.evt.EvtAgentRepository;
import ru.igorit.monitoring.rabbit.service.CommandSender;
import ru.igorit.monitoring.security.util.SecurityAccessUtils;

import java.util.*;

import static ru.igorit.monitoring.security.util.AuthInfoUtils.extractUserId;
import static ru.igorit.monitoring.security.util.AuthInfoUtils.getCurrentAuth;

@Service
@RequiredArgsConstructor
@Log4j2
public class EvtManageService {
    private final EvtModelMapper evtModelMapper;
    private final EvtAgentRepository agentRepo;
    private final EvtAgentConfigRepository cfgRepo;
    private final OrganizationRepository commonOrgRepo;
    private final SecurityAccessUtils sa;
    private final CommandSender commandSender;
    private final EventCommandMapper eventCommandMapper;


    public List<EvtAgentTypeDto> getAgentTypes() {
        return Arrays.stream(EvtAgentType.values()).map(evtModelMapper::toDto).toList();
    }

    @Transactional(readOnly = true)
    @PreAuthorize("@securityAccessUtils.isAllowedAllActions()")
    public List<EvtAgentListDto> getAllAgents() {
        return agentRepo.findAllProjectedBy().stream()
                .map(evtModelMapper::toListDto)
                .filter(f -> sa.isSuperUser() || sa.isAllowedOrganization(f.getOrganizationId()))
                .sorted(Comparator.comparing(EvtAgentListDto::getName)
                        .thenComparing(EvtAgentListDto::getDescription)
                        .thenComparing(EvtAgentListDto::getId))
                .toList();
    }

    @Transactional(readOnly = true)
    @PreAuthorize("@securityAccessUtils.isAllowedOrganization(#organizationId)")
    public List<EvtAgentListDto> getAgentsByOrganization(String organizationId) {
        return agentRepo.findProjectedByOrganizationId(organizationId).stream()
                .sorted(Comparator.comparing(EvtAgentListProjection::getName)
                        .thenComparing(EvtAgentListProjection::getDescription)
                        .thenComparing(EvtAgentListProjection::getId))
                .map(evtModelMapper::toListDto).toList();
    }

    @Transactional(readOnly = true)
    @PreAuthorize("@securityAccessUtils.isSuperUser()")
    public List<EvtAgentListDto> getAgentsByOrganizationWithUnbounded(String organizationId) {
        return agentRepo.findAllProjectedBy().stream()
                .filter(f -> f.getOrganization() == null || Objects.equals(f.getOrganization().getId(), organizationId))
                .sorted(Comparator.comparing(EvtAgentListProjection::getName)
                        .thenComparing(EvtAgentListProjection::getDescription)
                        .thenComparing(EvtAgentListProjection::getId))
                .map(evtModelMapper::toListDto).toList();
    }

    @Transactional(readOnly = true)
    @PreAuthorize("@securityAccessUtils.isAllowedAllActions()")
    public EvtAgentItemDto getAgent(String agentId) {
        var stored = agentRepo.findById(agentId).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Event Agent with id " + agentId + " not found"));
        var ret = evtModelMapper.toDto(stored);
        if (!(sa.isAllowedAllOrganizations() || sa.isAllowedOrganization(ret.getOrganizationId()))) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Event Agent with id " + agentId + " not found");
        }
        return ret;
    }

    @Transactional
    @PreAuthorize("@securityAccessUtils.isSuperUser()")
    public EvtAgentItemDto addAgent(EvtAgentListDto dto) {
        var agentType = Optional.ofNullable(EvtAgentType.byId(dto.getAgentType())).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Not known Event agent type"));
        var org = dto.getOrganizationId() == null ? null :
                commonOrgRepo.findById(dto.getOrganizationId()).orElseThrow(
                        () -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Not exists organization"));
        EvtAgent agent = null;
        switch (agentType) {
            case Macroscop -> {
                agent = new MacroscopEvtAgent();
            }
            default ->
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported Event agent type: " + agentType);
        }
        agent.setName(dto.getName());
        agent.setDescription(dto.getDescription());
        agent.setOrganization(org);
        agent.setCreatedBy(extractUserId(getCurrentAuth()));
        agent.setConfigured(false);

        agent = agentRepo.save(agent);

        assert org != null;
        org.setUpdatedBy(extractUserId(getCurrentAuth()));
        commonOrgRepo.save(org);
        return evtModelMapper.toDto(agent);
    }

    @Transactional
    @PreAuthorize("@securityAccessUtils.isAllowedAllActions()")
    public EvtAgentItemDto updateAgent(String agentId, EvtAgentItemDto dto) {
        if (dto == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request data for Event Agent is empty");
        }
        if (!agentId.equalsIgnoreCase(dto.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request Id not equal Event Agent id=" + dto.getId());
        }
        var stored = agentRepo.findById(agentId).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Event Agent with id " + agentId + " not found"));
        String storedOrgId = Optional.ofNullable(stored.getOrganization()).map(Organization::getId).orElse(null);
        if (!(sa.isAllowedAllOrganizations() || sa.isAllowedOrganization(storedOrgId))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Event Agent with id " + agentId + " not allowed for change");
        }
        var changeOrg = !Objects.equals(storedOrgId, dto.getOrganizationId());
        if (changeOrg && !sa.isSuperUser()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Event Agent organization binding not allowed");
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
        return evtModelMapper.toDto(stored);
    }

    @Transactional
    @PreAuthorize("@securityAccessUtils.isSuperUser()")
    public void deleteAgent(String agentId) {
        agentRepo.findById(agentId).ifPresent(curr -> _unbindAgent(agentId));
        agentRepo.deleteById(agentId);
    }


    @Transactional
    @PreAuthorize("@securityAccessUtils.isSuperUser()")
    public EvtAgentItemDto unbindAgent(String agentId) {
        return evtModelMapper.toDto(_unbindAgent(agentId));
    }

    @Transactional
    @PreAuthorize("@securityAccessUtils.isSuperUser()")
    public EvtAgentItemDto bindAgent(String agentId, String orgId) {
        return evtModelMapper.toDto(_bindAgent(agentId, orgId));
    }

    @Transactional
    @PreAuthorize("@securityAccessUtils.isAllowedAllActions()")
    public EvtAgentConfigDto getAgentConfig(String agentId) {
        getAgent(agentId);
        var agent = agentRepo.findById(agentId).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Event Agent with id " + agentId + " not found"));
        var config = agent.getConfig();
        if (config == null) {
            switch (agent.getType()) {
                case Macroscop -> {
                    config = new MacroscopEvtAgentConfig(agent);
                    config.setCreatedBy(extractUserId(getCurrentAuth()));
                    config = cfgRepo.saveAndFlush(config);
                    agent.setConfig(config);
                    agent.setUpdatedBy(extractUserId(getCurrentAuth()));
                    config.setCreatedBy(extractUserId(getCurrentAuth()));
                    agentRepo.save(agent);
                }
                default ->
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported Event agent type: " + agent.getType());
            }
        }
        return evtModelMapper.toDto(config);
    }


    public EvtAgent _bindAgent(String agentId, String orgId) {
        var stored = agentRepo.findById(agentId).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Event Agent with id " + agentId + " not found"));
        var currOrg = stored.getOrganization();
        if (currOrg != null) {
            if (agentRepo.findByOrganizationId(currOrg.getId()).stream().allMatch(f -> Objects.equals(f.getId(), agentId))) {
                currOrg.setEventAgentsSet(false);
                currOrg.setUpdatedBy(extractUserId(getCurrentAuth()));
                currOrg = commonOrgRepo.saveAndFlush(currOrg);
                sendOrgChangeEvent(currOrg);
            }
            stored.setOrganization(null);
        }
        var newOrg = commonOrgRepo.findById(orgId).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organization with id " + orgId + " not found"));
        if (!newOrg.isEventAgentsSet()) {
            newOrg.setUpdatedBy(extractUserId(getCurrentAuth()));
            newOrg = commonOrgRepo.save(newOrg);
            sendOrgChangeEvent(newOrg);
        }
        stored.setOrganization(newOrg);
        stored.setUpdatedBy(extractUserId(getCurrentAuth()));
        return agentRepo.save(stored);
    }

    private EvtAgent _unbindAgent(String agentId) {
        var stored = agentRepo.findById(agentId).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Event Agent with id " + agentId + " not found"));
        var currOrg = stored.getOrganization();
        if (currOrg != null) {
            if (agentRepo.findByOrganizationId(currOrg.getId()).stream().allMatch(f -> Objects.equals(f.getId(), agentId))) {
                currOrg.setEventAgentsSet(false);
                currOrg.setUpdatedBy(extractUserId(getCurrentAuth()));
                currOrg = commonOrgRepo.saveAndFlush(currOrg);
                sendOrgChangeEvent(currOrg);
            }
        }
        stored.setOrganization(null);
        stored.setUpdatedBy(extractUserId(getCurrentAuth()));
        return agentRepo.save(stored);
    }

    private void sendOrgChangeEvent(Organization organization) {
        var targets = List.of(commandSender.getConfig().getMonServerRoute());
        OrganizationInfoChangedEventCommandDto event = eventCommandMapper.toOrgChangeEvent(organization);
        event.setMode(OrganizationInfoChangedEventCommandDto.Mode.UPDATE_EVT_BIND);
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
