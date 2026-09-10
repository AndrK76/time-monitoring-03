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
import ru.igorit.monitoring.lib.dto.yclients.YClientCredentialsDto;
import ru.igorit.monitoring.lib.dto.yclients.YClientsAgentConfigDto;
import ru.igorit.monitoring.lib.persistence.entity.yclients.YClientCredentials;
import ru.igorit.monitoring.lib.persistence.entity.yclients.YClientsAgentConfig;
import ru.igorit.monitoring.lib.persistence.repository.yclients.YClientsAgentConfigRepository;

@Service
@RequiredArgsConstructor
@Log4j2
public class YClientsManageService {

    @Value("${security.store.xor}")
    private String xorSecret;

    private final YClientsModelMapper mapper;
    private final YClientsAgentConfigRepository configRepo;
    private final CrmManageService crmService;

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
        return unmaskCreds(mapper.toDto(configRepo.save(stored)));
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
