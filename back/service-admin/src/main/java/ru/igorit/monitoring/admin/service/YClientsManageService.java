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
import ru.igorit.monitoring.lib.persistence.entity.yclients.YClientCredentials;
import ru.igorit.monitoring.lib.persistence.entity.yclients.YClientsAgentConfig;
import ru.igorit.monitoring.lib.persistence.entity.yclients.YClientsOrganization;
import ru.igorit.monitoring.lib.persistence.repository.crm.CrmAgentRepository;
import ru.igorit.monitoring.lib.persistence.repository.crm.CrmOrganizationRepository;
import ru.igorit.monitoring.lib.persistence.repository.yclients.YClientsAgentConfigRepository;
import ru.igorit.monitoring.lib.persistence.repository.yclients.YClientsAgentRepository;
import ru.igorit.monitoring.lib.persistence.repository.yclients.YClientsOrganizationRepository;
import ru.igorit.monitoring.yclients.service.manage.ConfigManageService;

import java.util.List;
import java.util.Objects;

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
    private final CrmOrganizationRepository crmOrgRepo;
    private final CrmAgentRepository crmAgentRepo;
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
        var agent = crmService.getAgent(agentId);
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
        var agent = crmService.getAgent(agentId);
        var org = orgRepo.findByAgentId(agentId).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Org for Agent Id=" + agentId + " not found"));
        if (!Objects.equals(org.getId(), dto.getId())) {
            throw  new ResponseStatusException(HttpStatus.BAD_REQUEST, "Org Id incorrect");
        }
        org.setUpdatedBy(extractUserId(getCurrentAuth()));
        org.setYclientsId(dto.getYcId());
        org.setYclientsName(dto.getName());
        org.setYclientsTimezone(dto.getTimezone());
        org =orgRepo.saveAndFlush(org);
        return mapper.toDto((YClientsOrganization) org);
    }


    @PreAuthorize("@securityAccessUtils.isAllowedAllActions()")
    public YClientsTokenResponseDto getClientToken(YClientsTokenRequestDto request) {
        return ycManageService.getClientToken(request);
    }

    @Transactional(readOnly = true)
    @PreAuthorize("@securityAccessUtils.isAllowedAllActions()")
    public YClientsDataResponse<List<YClientsOrganizationDto>> getAllowedOrganizations(String agentId) {
        var config = unmaskCreds(mapper.toDto(_getConfig(agentId)));
        return ycManageService.getClientOrganizations(config.getCredentials());
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
