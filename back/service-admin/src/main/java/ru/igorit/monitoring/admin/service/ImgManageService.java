package ru.igorit.monitoring.admin.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import ru.igorit.monitoring.admin.mapper.EventCommandMapper;
import ru.igorit.monitoring.admin.mapper.ImgModelMapper;
import ru.igorit.monitoring.common.dto.command.auth.OrganizationInfoChangedEventCommandDto;
import ru.igorit.monitoring.common.enums.command.CommandMessageType;
import ru.igorit.monitoring.lib.dto.img.*;
import ru.igorit.monitoring.lib.enums.ImgAgentType;
import ru.igorit.monitoring.lib.persistence.entity.common.Organization;
import ru.igorit.monitoring.lib.persistence.entity.img.ImgAgent;
import ru.igorit.monitoring.lib.persistence.entity.img.ImgAgentListProjection;
import ru.igorit.monitoring.lib.persistence.entity.macroscop.MacroscopImgAgent;
import ru.igorit.monitoring.lib.persistence.entity.macroscop.MacroscopImgAgentConfig;
import ru.igorit.monitoring.lib.persistence.repository.common.OrganizationRepository;
import ru.igorit.monitoring.lib.persistence.repository.img.ImgAgentConfigRepository;
import ru.igorit.monitoring.lib.persistence.repository.img.ImgAgentRepository;
import ru.igorit.monitoring.lib.persistence.repository.img.ImgPlaceRepository;
import ru.igorit.monitoring.rabbit.service.CommandSender;
import ru.igorit.monitoring.security.util.SecurityAccessUtils;

import java.util.*;

import static ru.igorit.monitoring.security.util.AuthInfoUtils.extractUserId;
import static ru.igorit.monitoring.security.util.AuthInfoUtils.getCurrentAuth;

@Service
@RequiredArgsConstructor
@Log4j2
public class ImgManageService {
    private final ImgModelMapper imgModelMapper;
    private final ImgAgentRepository agentRepo;
    private final ImgAgentConfigRepository cfgRepo;
    private final ImgPlaceRepository placeRepo;
    private final OrganizationRepository commonOrgRepo;
    private final SecurityAccessUtils sa;
    private final CommandSender commandSender;
    private final EventCommandMapper eventCommandMapper;

    public List<ImgAgentTypeDto> getAgentTypes() {
        return Arrays.stream(ImgAgentType.values()).map(imgModelMapper::toDto).toList();
    }

    @Transactional(readOnly = true)
    @PreAuthorize("@securityAccessUtils.isAllowedAllActions()")
    public List<ImgAgentListDto> getAllAgents() {
        return agentRepo.findAllProjectedBy().stream()
                .map(imgModelMapper::toListDto)
                .filter(f -> sa.isSuperUser() || sa.isAllowedOrganization(f.getOrganizationId()))
                .sorted(Comparator.comparing(ImgAgentListDto::getName)
                        .thenComparing(ImgAgentListDto::getDescription)
                        .thenComparing(ImgAgentListDto::getId))
                .toList();
    }

    @Transactional(readOnly = true)
    @PreAuthorize("@securityAccessUtils.isAllowedOrganization(#organizationId)")
    public List<ImgAgentListDto> getAgentsByOrganization(String organizationId) {
        return agentRepo.findProjectedByOrganizationId(organizationId).stream()
                .sorted(Comparator.comparing(ImgAgentListProjection::getName)
                        .thenComparing(ImgAgentListProjection::getDescription)
                        .thenComparing(ImgAgentListProjection::getId))
                .map(imgModelMapper::toListDto).toList();
    }

    @Transactional(readOnly = true)
    @PreAuthorize("@securityAccessUtils.isSuperUser()")
    public List<ImgAgentListDto> getAgentsByOrganizationWithUnbounded(String organizationId) {
        return agentRepo.findAllProjectedBy().stream()
                .filter(f -> f.getOrganization() == null || Objects.equals(f.getOrganization().getId(), organizationId))
                .sorted(Comparator.comparing(ImgAgentListProjection::getName)
                        .thenComparing(ImgAgentListProjection::getDescription)
                        .thenComparing(ImgAgentListProjection::getId))
                .map(imgModelMapper::toListDto).toList();
    }

    @Transactional(readOnly = true)
    @PreAuthorize("@securityAccessUtils.isAllowedAllActions()")
    public ImgAgentItemDto getAgent(String agentId) {
        var stored = agentRepo.findByIdWithPlaces(agentId).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Camera Agent with id " + agentId + " not found"));
        var ret = imgModelMapper.toDto(stored);
        if (!(sa.isAllowedAllOrganizations() || sa.isAllowedOrganization(ret.getOrganizationId()))) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Camera Agent with id " + agentId + " not found");
        }
        return ret;
    }

    @Transactional
    @PreAuthorize("@securityAccessUtils.isSuperUser()")
    public ImgAgentItemDto addAgent(ImgAgentListDto dto) {
        var agentType = Optional.ofNullable(ImgAgentType.byId(dto.getAgentType())).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Not known Camera agent type"));
        var org = dto.getOrganizationId() == null ? null :
                commonOrgRepo.findById(dto.getOrganizationId()).orElseThrow(
                        () -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Not exists organization"));
        ImgAgent agent = null;
        switch (agentType) {
            case Macroscop -> {
                agent = new MacroscopImgAgent();
            }
            default ->
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported Camera agent type: " + agentType);
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
        return imgModelMapper.toDto(agent);
    }

    @Transactional
    @PreAuthorize("@securityAccessUtils.isAllowedAllActions()")
    public ImgAgentItemDto updateAgent(String agentId, ImgAgentItemDto dto) {
        if (dto == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request data for Camera Agent is empty");
        }
        if (!agentId.equalsIgnoreCase(dto.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request Id not equal Camera Agent id=" + dto.getId());
        }
        var stored = agentRepo.findById(agentId).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Camera Agent with id " + agentId + " not found"));
        String storedOrgId = Optional.ofNullable(stored.getOrganization()).map(Organization::getId).orElse(null);
        if (!(sa.isAllowedAllOrganizations() || sa.isAllowedOrganization(storedOrgId))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Camera Agent with id " + agentId + " not allowed for change");
        }
        var changeOrg = !Objects.equals(storedOrgId, dto.getOrganizationId());
        if (changeOrg && !sa.isSuperUser()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Camera Agent organization binding not allowed");
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
        return imgModelMapper.toDto(stored);
    }

    @Transactional
    @PreAuthorize("@securityAccessUtils.isSuperUser()")
    public void deleteAgent(String agentId) {
        agentRepo.findById(agentId).ifPresent(curr -> _unbindAgent(agentId));
        agentRepo.deleteById(agentId);
    }

    @Transactional
    @PreAuthorize("@securityAccessUtils.isSuperUser()")
    public ImgAgentItemDto unbindAgent(String agentId) {
        return imgModelMapper.toDto(_unbindAgent(agentId));
    }

    @Transactional
    @PreAuthorize("@securityAccessUtils.isSuperUser()")
    public ImgAgentItemDto bindAgent(String agentId, String orgId) {
        return imgModelMapper.toDto(_bindAgent(agentId, orgId));
    }

    @Transactional(readOnly = true)
    @PreAuthorize("@securityAccessUtils.isAllowedAllActions()")
    public List<ImgPlaceListDto> getPlacesForAgent(String agentId) {
        getAgent(agentId);
        return placeRepo.findByAgentId(agentId).stream()
                .filter(f->!Boolean.TRUE.equals(f.getDeleted()))
                .map(imgModelMapper::toListDto)
                .sorted(Comparator.comparing(ImgPlaceListDto::getName).thenComparing(ImgPlaceListDto::getId))
                .toList();
    }

    @Transactional
    @PreAuthorize("@securityAccessUtils.isAllowedAllActions()")
    public ImgAgentConfigDto getAgentConfig(String agentId) {
        getAgent(agentId);
        var agent = agentRepo.findById(agentId).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Camera Agent with id " + agentId + " not found"));
        var config = agent.getConfig();
        if (config == null) {
            switch (agent.getType()) {
                case Macroscop -> {
                    config = new MacroscopImgAgentConfig(agent);
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
        return imgModelMapper.toDto(config);
    }


    public ImgAgent _bindAgent(String agentId, String orgId) {
        var stored = agentRepo.findById(agentId).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Camera Agent with id " + agentId + " not found"));
        var currOrg = stored.getOrganization();
        if (currOrg != null) {
            if (agentRepo.findByOrganizationId(currOrg.getId()).stream().allMatch(f -> Objects.equals(f.getId(), agentId))) {
                currOrg.setCameraAgentsSet(false);
                currOrg.setUpdatedBy(extractUserId(getCurrentAuth()));
                currOrg = commonOrgRepo.saveAndFlush(currOrg);
                sendOrgChangeEvent(currOrg);
            }
            stored.setOrganization(null);
        }
        var newOrg = commonOrgRepo.findById(orgId).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organization with id " + orgId + " not found"));
        if (!newOrg.isCameraAgentsSet()) {
            newOrg.setUpdatedBy(extractUserId(getCurrentAuth()));
            newOrg = commonOrgRepo.save(newOrg);
            sendOrgChangeEvent(newOrg);
        }
        stored.setOrganization(newOrg);
        stored.setUpdatedBy(extractUserId(getCurrentAuth()));
        return agentRepo.save(stored);
    }

    private ImgAgent _unbindAgent(String agentId) {
        var stored = agentRepo.findById(agentId).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Camera Agent with id " + agentId + " not found"));
        var currOrg = stored.getOrganization();
        if (currOrg != null) {
            if (agentRepo.findByOrganizationId(currOrg.getId()).stream().allMatch(f -> Objects.equals(f.getId(), agentId))) {
                currOrg.setCameraAgentsSet(false);
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
        event.setMode(OrganizationInfoChangedEventCommandDto.Mode.UPDATE_IMG_BIND);
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
