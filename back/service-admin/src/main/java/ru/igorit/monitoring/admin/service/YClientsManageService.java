package ru.igorit.monitoring.admin.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import ru.igorit.monitoring.admin.mapper.YClientsModelMapper;
import ru.igorit.monitoring.common.util.XorCipher;
import ru.igorit.monitoring.lib.dto.yclients.*;
import ru.igorit.monitoring.lib.persistence.entity.crm.CrmAgent;
import ru.igorit.monitoring.lib.persistence.entity.crm.CrmOrganization;
import ru.igorit.monitoring.lib.persistence.entity.yclients.*;
import ru.igorit.monitoring.lib.persistence.repository.crm.CrmAgentRepository;
import ru.igorit.monitoring.lib.persistence.repository.crm.CrmOrganizationRepository;
import ru.igorit.monitoring.lib.persistence.repository.crm.CrmServiceRepository;
import ru.igorit.monitoring.lib.persistence.repository.yclients.*;
import ru.igorit.monitoring.yclients.service.manage.ConfigManageService;

import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

import static ru.igorit.monitoring.security.util.AuthInfoUtils.extractUserId;
import static ru.igorit.monitoring.security.util.AuthInfoUtils.getCurrentAuth;

@Service
@RequiredArgsConstructor
@Log4j2
public class YClientsManageService {

    @Value("${security.store.xor}")
    private String xorSecret;

    private final YClientsModelMapper mapper;
    private final YClientsAgentRepository agentRepo;
    private final YClientsAgentConfigRepository configRepo;
    private final YClientsOrganizationRepository orgRepo;
    private final YClientsServiceCategoryRepository serviceCategoryRepo;
    private final YClientsServiceRepository serviceRepo;
    private final CrmOrganizationRepository crmOrgRepo;
    private final CrmAgentRepository crmAgentRepo;
    private final CrmServiceRepository crmServiceRepo;
    private final CrmManageService crmService;
    private final ConfigManageService ycManageService;

    @Transactional(readOnly = true)
    @PreAuthorize("@securityAccessUtils.isAllowedAllActions()")
    public YClientsAgentConfigDto getConfig(String agentId) {
        var ret = mapper.toDto(_getConfig(agentId));
        return unmaskCreds(ret);
    }

    @Transactional
    @PreAuthorize("@securityAccessUtils.isAllowedAllActions()")
    public YClientsAgentConfigDto updateConfig(String agentId, YClientsAgentConfigDto dto) {
        var stored = _getConfig(agentId);
        if (dto == null || dto.getCredentials() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Incorrect request data");
        }
        if (!agentId.equalsIgnoreCase(dto.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request Id not equal YClients Agent id=" + dto.getId());
        }
        var newCreds = mapper.fromDto(dto.getCredentials());
        var currCreds = stored.getCredentials();
        currCreds.fillFrom(newCreds);
        currCreds = maskCreds(currCreds);
        stored.setCredentials(currCreds);
        stored.setUpdatedBy(extractUserId(getCurrentAuth()));
        return unmaskCreds(mapper.toDto(configRepo.save(stored)));
    }


    @Transactional
    @PreAuthorize("@securityAccessUtils.isAllowedAllActions()")
    public YClientsOrganizationDto getOrganizationForAgent(String agentId) {
        crmService.getAgent(agentId);
        CrmOrganization ret = agentRepo.findById(agentId).map(CrmAgent::getCrmOrganization)
                .orElse(null);
        if (ret == null) {
            var crmOrg = new CrmOrganization();
            crmOrg.setCreatedBy(extractUserId(getCurrentAuth()));
            var crmAgent = crmAgentRepo.findById(agentId).orElseThrow();
            crmOrg.setAgent(crmAgent);
            ret = crmOrgRepo.saveAndFlush(new YClientsOrganization(crmOrg));
            crmAgent.setCrmOrganization(ret);
            crmAgent.setUpdatedBy(extractUserId(getCurrentAuth()));
            crmAgentRepo.saveAndFlush(crmAgent);
        }
        ret = orgRepo.findById(ret.getId()).orElseThrow();
        return mapper.toDto((YClientsOrganization) ret);
    }


    @Transactional
    @PreAuthorize("@securityAccessUtils.isAllowedAllActions()")
    public YClientsOrganizationDto updateOrganizationForAgent(String agentId, YClientsOrganizationDto dto) {
        crmService.getAgent(agentId);
        var org = orgRepo.findByAgentId(agentId).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Org for Agent Id=" + agentId + " not found"));
        if (!Objects.equals(org.getId(), dto.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Org Id incorrect");
        }
        org.setUpdatedBy(extractUserId(getCurrentAuth()));
        org.setYclientsId(dto.getYcId());
        org.setYclientsName(dto.getName());
        org.setYclientsTimezone(dto.getTimezone());
        org = orgRepo.saveAndFlush(org);
        return mapper.toDto(org);
    }

    @Transactional
    @PreAuthorize("@securityAccessUtils.isAllowedAllActions()")
    public List<YClientsServiceCategoryListDto> getServiceCategoriesForAgent(String agentId) {
        crmService.getAgent(agentId);
        return serviceCategoryRepo.findByAgentId(agentId).stream()
                .map(mapper::toDto).toList();
    }

    @Transactional
    @PreAuthorize("@securityAccessUtils.isAllowedAllActions()")
    public List<YClientsServiceCategoryListDto> updateServiceCategoriesForAgent(
            String agentId, List<YClientsServiceCategoryListDto> dto) {
        crmService.getAgent(agentId);
        var agent = agentRepo.findById(agentId).orElseThrow(); //Throw не будет, так как на getAgent есть все проверки
        var org = orgRepo.findByAgentId(agentId).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "YClients organization for agent id=" + agentId + " not found"));
        var exists = serviceCategoryRepo.findByAgentId(agentId);
        var creatorId = extractUserId(getCurrentAuth());
        var existMap = exists.stream()
                .collect(Collectors.toMap(YClientsServiceCategory::getYClientsId, e -> e, (a, b) -> a));
        var dtoMap = dto.stream()
                .collect(Collectors.toMap(YClientsServiceCategoryListDto::getId, d -> d, (a, b) -> a));
        var toDelete = exists.stream()
                .filter(e -> !dtoMap.containsKey(e.getYClientsId()))
                .toList();
        if (!toDelete.isEmpty()) {
            serviceCategoryRepo.deleteAll(toDelete);
        }
        var toSave = dto.stream()
                .map(d -> {
                    var existing = existMap.get(d.getId());
                    if (existing != null) {
                        existing.setYClientsName(d.getName());
                        existing.setUpdatedBy(creatorId);
                        return existing;
                    }
                    var newCat = new YClientsServiceCategory();
                    newCat.setYClientsId(d.getId());
                    newCat.setYClientsName(d.getName());
                    newCat.setAgent(agent);
                    newCat.setOrganization(org);
                    newCat.setCreatedBy(creatorId);
                    return newCat;
                })
                .toList();
        if (!toSave.isEmpty()) {
            serviceCategoryRepo.saveAll(toSave);
        }
        return serviceCategoryRepo.findByAgentId(agentId).stream()
                .map(mapper::toDto)
                .toList();
    }

    @Transactional
    @PreAuthorize("@securityAccessUtils.isAllowedAllActions()")
    public List<YClientsServiceDto> getServicesForAgent(String agentId) {
        crmService.getAgent(agentId);
        return serviceRepo.findByAgentId(agentId).stream().map(mapper::toDto).toList();
    }

    @Transactional
    @PreAuthorize("@securityAccessUtils.isAllowedAllActions()")
    public YClientsServiceDto addServiceForAgent(String agentId, YClientsServiceDto dto) {
        crmService.getAgent(agentId);
        var agent = agentRepo.findById(agentId).orElseThrow(); //Throw не будет, так как на getAgent есть все проверки
        serviceRepo.findByAgent_IdAndYClientsId(agentId, dto.getYcId()).ifPresent(ignored -> {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "service with id=" + dto.getYcId()
                            + " already registered for agent " + agentId);
                }
        );
        var category = serviceCategoryRepo.findById(dto.getCategoryId()).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown category id=" + dto.getCategoryId())
        );
        if (!Objects.equals(category.getAgent().getId(), agentId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "service category " + dto.getCategoryId()
                    + "not registered for agent " + agentId);
        }
        YClientsService ret = new YClientsService();
        ret.setName(dto.getName() == null ? dto.getYcName() : dto.getName());
        ret.setAgent(agent);
        ret.setCreatedBy(extractUserId(getCurrentAuth()));
        ret.setYClientsId(dto.getYcId());
        ret.setYClientsName(dto.getYcName());
        ret.setServiceCategory(category);
        ret = serviceRepo.save(ret);
        return mapper.toDto(ret);
    }

    @Transactional
    @PreAuthorize("@securityAccessUtils.isAllowedAllActions()")
    public YClientsServiceDto updateServiceForAgent(String agentId, String id, YClientsServiceDto dto) {
        crmService.getAgent(agentId);
        YClientsService ret = serviceRepo.findById(id).orElseThrow(()->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Service with id="+id+" not found"));
        ret.setYClientsName(dto.getYcName());
        ret.setName(dto.getName() == null ? dto.getYcName() : dto.getName());
        ret.setUpdatedBy(extractUserId(getCurrentAuth()));
        ret = serviceRepo.save(ret);
        return mapper.toDto(ret);
    }

    @Transactional
    @PreAuthorize("@securityAccessUtils.isAllowedAllActions()")
    public void deleteServiceForAgent(String agentId, String id) {
        crmService.getAgent(agentId);
        serviceRepo.deleteServiceById(id);
    }


    @PreAuthorize("@securityAccessUtils.isAllowedAllActions()")
    public YClientsTokenResponseDto getClientToken(YClientsTokenRequestDto request) {
        return ycManageService.getClientToken(request);
    }

    @Transactional(readOnly = true)
    @PreAuthorize("@securityAccessUtils.isAllowedAllActions()")
    public YClientsDataResponse<List<YClientsOrganizationDto>> getAllowedOrganizationsForAgent(String agentId) {
        var config = unmaskCreds(mapper.toDto(_getConfig(agentId)));
        return ycManageService.getClientOrganizations(config.getCredentials());
    }

    @Transactional(readOnly = true)
    @PreAuthorize("@securityAccessUtils.isAllowedAllActions()")
    public YClientsDataResponse<List<YClientsServiceCategoryListDto>> getAllowedServiceCategories(String agentId, Long orgId) {
        var agent = crmService.getAgent(agentId);
        var config = unmaskCreds(mapper.toDto(_getConfig(agent.getId())));
        return ycManageService.getOrganizationServiceCategories(orgId, config.getCredentials());
    }

    @Transactional(readOnly = true)
    @PreAuthorize("@securityAccessUtils.isAllowedAllActions()")
    public YClientsDataResponse<List<YClientsServiceDto>> getAllowedServices(String agentId) {
        var agent = crmService.getAgent(agentId);
        var config = unmaskCreds(mapper.toDto(_getConfig(agent.getId())));
        var orgId = orgRepo.findByAgentId(agentId)
                .map(YClientsOrganization::getYclientsId)
                .orElseThrow(() ->
                        new ResponseStatusException(HttpStatus.BAD_REQUEST, "Organization for agent=" + agentId + " not set"));
        var categoryIds = serviceCategoryRepo.findByAgentId(agentId).stream().map(YClientsServiceCategory::getYClientsId).toList();
        if (categoryIds.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Service categories not set for agent=" + agentId);
        }
        return ycManageService.getServicesForOrganization(orgId, categoryIds, config.getCredentials());
    }


    private YClientsAgentConfig _getConfig(String agentId) {
        var agent = crmService.getAgent(agentId);
        return configRepo.findById(agent.getId()).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Config for YClients agent with id " + agentId + " not found"));

    }

    private YClientCredentials unmaskCreds(YClientCredentials src) {
        if (src == null) {
            return src;
        }
        src.setUserToken(XorCipher.decrypt(src.getUserToken(), xorSecret));
        src.setPartnerToken(XorCipher.decrypt(src.getPartnerToken(), xorSecret));
        return src;
    }

    private YClientCredentials maskCreds(YClientCredentials src) {
        if (src == null) {
            return src;
        }
        src.setUserToken(XorCipher.encrypt(src.getUserToken(), xorSecret));
        src.setPartnerToken(XorCipher.encrypt(src.getPartnerToken(), xorSecret));
        return src;
    }

    private YClientsAgentConfigDto unmaskCreds(YClientsAgentConfigDto dto) {
        if (dto != null) {
            dto.setCredentials(
                    mapper.toDto(unmaskCreds(mapper.fromDto(dto.getCredentials()))));
        }
        return dto;
    }


}
