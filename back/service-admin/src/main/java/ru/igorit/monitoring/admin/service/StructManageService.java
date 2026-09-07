package ru.igorit.monitoring.admin.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import ru.igorit.monitoring.admin.mapper.EventCommandMapper;
import ru.igorit.monitoring.admin.mapper.StructModelMapper;
import ru.igorit.monitoring.common.dto.command.auth.OrganizationInfoChangedEventCommandDto;
import ru.igorit.monitoring.common.enums.command.CommandMessageType;
import ru.igorit.monitoring.lib.dto.OrgStructListDto;
import ru.igorit.monitoring.lib.persistence.entity.common.Organization;
import ru.igorit.monitoring.lib.persistence.repository.common.OrganizationRepository;
import ru.igorit.monitoring.rabbit.service.CommandSender;
import ru.igorit.monitoring.security.util.SecurityAccessUtils;

import java.util.List;

@Service
@RequiredArgsConstructor
@Log4j2
public class StructManageService {
    private final StructModelMapper structMapper;
    private final OrganizationRepository orgRepo;
    private final SecurityAccessUtils sa;
    private final EventCommandMapper eventCommandMapper;
    private final CommandSender commandSender;


    @Transactional(readOnly = true)
    public List<OrgStructListDto> getAllowedOrganizations() {
        return orgRepo.findAll().stream()
                .map(structMapper::toListDto)
                .filter(this::filterOrganization)
                .toList();
    }

    @Transactional(readOnly = true)
    public OrgStructListDto getOrganization(String id) {
        checkOrgId(id);
        return structMapper.toListDto(orgRepo.findById(id).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND)));
    }

    @Transactional()
    @PreAuthorize("@securityAccessUtils.isAllowedAllActions()")
    public OrgStructListDto updateOrganization(String id, OrgStructListDto org) {
        checkOrgId(id);
        var stored = orgRepo.findById(id).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        stored.setShortName(org.getShortName());
        stored.setFullName(org.getFullName());
        var ret = orgRepo.save(stored);
        sendOrgAddOrUpdatedEvent(stored);
        return structMapper.toListDto(ret);
    }


    private boolean filterOrganization(OrgStructListDto org) {
        return sa.isAllowedOrganization(org.getId());
    }

    private void checkOrgId(String orgId) {
        if (!sa.isAllowedOrganization(orgId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
    }

    private void sendOrgAddOrUpdatedEvent(Organization organization) {
        OrganizationInfoChangedEventCommandDto event = eventCommandMapper.toOrgChangeEvent(organization);
        event.setMode(OrganizationInfoChangedEventCommandDto.Mode.UPDATE_NAME);
        sendEvent(event);
    }

    private void sendEvent(OrganizationInfoChangedEventCommandDto event) {
        sendEventTo(commandSender.getConfig().getAuthServerRoute(), event);
        sendEventTo(commandSender.getConfig().getMonServerRoute(), event);
    }

    private void sendEventTo(String targetRoute, OrganizationInfoChangedEventCommandDto event) {
        try {
            commandSender.sendCommandToInternal(targetRoute,
                    CommandMessageType.ORGANIZATION_INFO_CHANGED, event);
            log.info("Organization {} event sent for organization: {}", event.getMode(), event.getOrgId());
        } catch (Exception e) {
            log.info("Failed to send organization {} event sent for organization: {}", event.getMode(), event.getOrgId());
        }
    }

}
