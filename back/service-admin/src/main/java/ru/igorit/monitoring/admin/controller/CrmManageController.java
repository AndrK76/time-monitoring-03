package ru.igorit.monitoring.admin.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import ru.igorit.monitoring.admin.service.CrmManageService;
import ru.igorit.monitoring.lib.dto.crm.CrmAgentItemDto;
import ru.igorit.monitoring.lib.dto.crm.CrmAgentListDto;
import ru.igorit.monitoring.lib.dto.crm.CrmAgentTypeDto;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/crm")
public class CrmManageController {
    private final CrmManageService service;

    @GetMapping({"/types", "/types/"})
    public List<CrmAgentTypeDto> getAgentTypes() {
        return service.getAgentTypes();
    }

    @GetMapping({"/agents", "/agents/"})
    public List<CrmAgentListDto> getAllAgents() {
        return service.getAllAgents();
    }

    @GetMapping(value = {"/agents"}, params = {"org"})
    public List<CrmAgentListDto> getAgentsByOrganization(@RequestParam("org") String organizationId) {
        return service.getAgentsByOrganization(organizationId);
    }

    @GetMapping(value = {"/agents"}, params = {"org","with_unbounded"})
    public List<CrmAgentListDto> getAgentsByOrganizationWithUnbounded(@RequestParam("org") String organizationId) {
        return service.getAgentsByOrganizationWithUnbounded(organizationId);
    }

    @GetMapping({"/agents/{id}"})
    public CrmAgentItemDto getAgentsById(@PathVariable("id") String agentId) {
        return service.getAgent(agentId);
    }

    @PostMapping({"/agents", "/agents/"})
    public ResponseEntity<?> addAgent(@Valid @RequestBody CrmAgentListDto dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.addAgent(dto));
    }

    @DeleteMapping({"/agents/{id}"})
    public ResponseEntity<?> deleteAgentsById(@PathVariable("id") String agentId) {
        service.deleteAgent(agentId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/agents/{id}/unbind")
    public CrmAgentItemDto unbindAgentFromOrg(@PathVariable("id") String agentId) {
        return service.unbindAgent(agentId);
    }

    @PutMapping(value = "/agents/{id}/bind", params = {"org"})
    public CrmAgentItemDto bindAgentToOrg(
            @PathVariable("id") String agentId,
            @RequestParam(name = "org") String orgId) {
        return service.bindAgent(agentId, orgId);
    }


}
