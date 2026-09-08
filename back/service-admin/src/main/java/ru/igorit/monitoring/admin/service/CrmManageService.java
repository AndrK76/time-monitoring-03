package ru.igorit.monitoring.admin.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import ru.igorit.monitoring.admin.mapper.CrmModelMapper;
import ru.igorit.monitoring.lib.dto.crm.CrmAgentItemDto;
import ru.igorit.monitoring.lib.dto.crm.CrmAgentListDto;
import ru.igorit.monitoring.lib.dto.crm.CrmAgentTypeDto;
import ru.igorit.monitoring.lib.enums.CrmAgentType;
import ru.igorit.monitoring.lib.persistence.entity.crm.CrmAgent;
import ru.igorit.monitoring.lib.persistence.entity.crm.CrmOrganization;
import ru.igorit.monitoring.lib.persistence.entity.yclients.YClientsAgent;
import ru.igorit.monitoring.lib.persistence.entity.yclients.YClientsOrganization;
import ru.igorit.monitoring.lib.persistence.repository.common.OrganizationRepository;
import ru.igorit.monitoring.lib.persistence.repository.crm.CrmAgentRepository;
import ru.igorit.monitoring.lib.persistence.repository.crm.CrmOrganizationRepository;

import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Log4j2
public class CrmManageService {
    private final CrmModelMapper crmModelMapper;
    private final CrmAgentRepository agentRepo;
    private final CrmOrganizationRepository orgRepo;
    private final OrganizationRepository commonOrgRepo;

    public List<CrmAgentTypeDto> getAgentTypes() {
        return Arrays.stream(CrmAgentType.values()).map(crmModelMapper::toDto).toList();
    }

    @Transactional(readOnly = true)
    @PreAuthorize("@securityAccessUtils.isSuperUser()")
    public List<CrmAgentListDto> getAllAgents() {
        return agentRepo.findAllProjectedBy().stream().map(crmModelMapper::toListDto).toList();
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
                .filter(f->f.getOrganization()==null || Objects.equals(f.getOrganization().getId(), organizationId))
                .map(crmModelMapper::toListDto).toList();
    }

    @Transactional
    @PreAuthorize("@securityAccessUtils.isSuperUser()")
    public CrmAgentItemDto addAgent(CrmAgentListDto dto) {
        var agentType = Optional.ofNullable(CrmAgentType.byId(dto.getAgentType())).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Not known CRM agent type"));
        if (!(agentRepo.findByOrganizationId(dto.getOrganizationId()).isEmpty())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Crm agent for organization " + dto.getOrganizationId() + " already exists");
        }
        var org = commonOrgRepo.findById(dto.getOrganizationId()).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Not exists organization"));
        var crmOrg = new CrmOrganization();
        var agent = CrmAgent.builder()
                .type(agentType)
                .name(dto.getName())
                .description(dto.getDescription())
                .configured(false)
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
        commonOrgRepo.save(org);
        return crmModelMapper.toDto(stored);
    }

    @Transactional(readOnly = true)
    @PreAuthorize("@securityAccessUtils.isAllowedAllActions()")
    public CrmAgentItemDto getAgent(String agentId) {
        var stored = agentRepo.findById(agentId).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "CRM Agent with id " + agentId + " not found"));
        return crmModelMapper.toDto(stored);
    }

    @Transactional
    @PreAuthorize("@securityAccessUtils.isSuperUser()")
    public void deleteAgent(String agentId) {
        var curr = agentRepo.findById(agentId).orElse(null);
        String orgId = curr == null ? null : curr.getCrmOrganization().getId();
        agentRepo.deleteById(agentId);
        if (orgId != null) {
            orgRepo.deleteById(orgId);
        }
    }

    @Transactional
    @PreAuthorize("@securityAccessUtils.isSuperUser()")
    public CrmAgentItemDto unbindAgent(String agentId) {
        var stored = agentRepo.findById(agentId).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "CRM Agent with id " + agentId + " not found"));
        var currOrg = stored.getOrganization();
        stored.setOrganization(null);
        var ret = agentRepo.save(stored);
        if (currOrg != null) {
            commonOrgRepo.save(currOrg);
        }
        return crmModelMapper.toDto(ret);
    }

    @Transactional
    @PreAuthorize("@securityAccessUtils.isSuperUser()")
    public CrmAgentItemDto bindAgent(String agentId, String orgId) {
        var stored = agentRepo.findById(agentId).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "CRM Agent with id " + agentId + " not found"));
        var currOrg = stored.getOrganization();
        if (currOrg != null) {
            stored.setOrganization(null);
            commonOrgRepo.saveAndFlush(currOrg);
        }
        var newOrg = commonOrgRepo.findById(orgId).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organization with id " + orgId + " not found"));
        var newOrgAgent = agentRepo.findByOrganizationId(newOrg.getId());
        if (!newOrgAgent.isEmpty()) {
            newOrgAgent.get(0).setOrganization(null);
            agentRepo.saveAndFlush(newOrgAgent.get(0));
        }
        stored.setOrganization(newOrg);
        commonOrgRepo.save(newOrg);
        var ret = agentRepo.save(stored);
        return crmModelMapper.toDto(ret);
    }

}
