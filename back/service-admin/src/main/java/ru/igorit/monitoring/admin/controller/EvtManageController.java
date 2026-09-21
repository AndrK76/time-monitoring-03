package ru.igorit.monitoring.admin.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import ru.igorit.monitoring.admin.service.EvtManageService;
import ru.igorit.monitoring.lib.dto.crm.CrmAgentConfigDto;
import ru.igorit.monitoring.lib.dto.crm.CrmAgentItemDto;
import ru.igorit.monitoring.lib.dto.crm.CrmAgentListDto;
import ru.igorit.monitoring.lib.dto.evt.EvtAgentConfigDto;
import ru.igorit.monitoring.lib.dto.evt.EvtAgentItemDto;
import ru.igorit.monitoring.lib.dto.evt.EvtAgentListDto;
import ru.igorit.monitoring.lib.dto.evt.EvtAgentTypeDto;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/evt")
public class EvtManageController {

    private final EvtManageService service;

    @GetMapping({"/types", "/types/"})
    public List<EvtAgentTypeDto> getAgentTypes() {
        return service.getAgentTypes();
    }

    @GetMapping({"/agents", "/agents/"})
    public List<EvtAgentListDto> getAllAgents() {
        return service.getAllAgents();
    }

    @GetMapping(value = {"/agents"}, params = {"org"})
    public List<EvtAgentListDto> getAgentsByOrganization(@RequestParam("org") String organizationId) {
        return service.getAgentsByOrganization(organizationId);
    }

    @GetMapping(value = {"/agents"}, params = {"org", "with_unbounded"})
    public List<EvtAgentListDto> getAgentsByOrganizationWithUnbounded(@RequestParam("org") String organizationId) {
        return service.getAgentsByOrganizationWithUnbounded(organizationId);
    }


    @GetMapping({"/agents/{id}"})
    public EvtAgentItemDto getAgentsById(@PathVariable("id") String agentId) {
        return service.getAgent(agentId);
    }

    @PostMapping({"/agents", "/agents/"})
    public ResponseEntity<?> addAgent(@Valid @RequestBody EvtAgentListDto dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.addAgent(dto));
    }

    @PutMapping({"/agents/{id}"})
    public EvtAgentItemDto updateAgent(@PathVariable(name = "id") String agentId, @Valid @RequestBody EvtAgentItemDto dto) {
        return service.updateAgent(agentId, dto);
    }


    @DeleteMapping({"/agents/{id}"})
    public ResponseEntity<?> deleteAgentsById(@PathVariable("id") String agentId) {
        service.deleteAgent(agentId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/agents/{id}/unbind")
    public EvtAgentItemDto unbindAgentFromOrg(@PathVariable("id") String agentId) {
        return service.unbindAgent(agentId);
    }

    @PutMapping(value = "/agents/{id}/bind", params = {"org"})
    public EvtAgentItemDto bindAgentToOrg(
            @PathVariable("id") String agentId,
            @RequestParam(name = "org") String orgId) {
        return service.bindAgent(agentId, orgId);
    }

    @GetMapping({"/configs/{id}"})
    EvtAgentConfigDto getAgentConfig(@PathVariable(name = "id") String agentId) {
        return service.getAgentConfig(agentId);
    }
}
