package ru.igorit.monitoring.admin.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.web.bind.annotation.*;
import ru.igorit.monitoring.admin.service.YClientsManageService;
import ru.igorit.monitoring.lib.dto.yclients.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/yc")
@Log4j2
public class YClientsManageController {
    private final YClientsManageService service;

    @GetMapping({"/configs/{id}"})
    public YClientsAgentConfigDto getConfig(@PathVariable("id") String agentId) {
        return service.getConfig(agentId);
    }

    @PutMapping({"/configs/{id}"})
    public YClientsAgentConfigDto updateConfig(@PathVariable("id") String agentId,
                                               @Valid @RequestBody YClientsAgentConfigDto data) {
        return service.updateConfig(agentId, data);
    }

    @GetMapping("/agents/{id}/organization")
    public YClientsOrganizationDto getOrganizationForAgent(@PathVariable("id") String agentId) {
        return service.getOrganizationForAgent(agentId);
    }

    @PutMapping("/agents/{id}/organization")
    public YClientsOrganizationDto updateOrganizationForAgent(
            @PathVariable("id") String agentId,
            @Valid @RequestBody YClientsOrganizationDto data) {
        return service.updateOrganizationForAgent(agentId, data);
    }

    @PostMapping("/misc/get-token")
    public YClientsTokenResponseDto getClientToken(@Valid @RequestBody YClientsTokenRequestDto request) {
        log.debug("Start get client-token");
        var ret = service.getClientToken(request);
        log.debug("End get client-token: {}", ret);
        return ret;
    }

    @GetMapping("/misc/agent/{id}/allowed-orgs")
    public YClientsDataResponse<List<YClientsOrganizationDto>> getAllowedOrganizations(@PathVariable(name = "id") String agentId) {
        return service.getAllowedOrganizations(agentId);
    }
}
