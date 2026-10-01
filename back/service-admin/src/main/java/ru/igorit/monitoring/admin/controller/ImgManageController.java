package ru.igorit.monitoring.admin.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import ru.igorit.monitoring.admin.service.ImgManageService;
import ru.igorit.monitoring.lib.dto.img.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/img")
public class ImgManageController {

    private final ImgManageService service;

    @GetMapping({"/types", "/types/"})
    public List<ImgAgentTypeDto> getAgentTypes() {
        return service.getAgentTypes();
    }

    @GetMapping({"/agents", "/agents/"})
    public List<ImgAgentListDto> getAllAgents() {
        return service.getAllAgents();
    }

    @GetMapping(value = {"/agents"}, params = {"org"})
    public List<ImgAgentListDto> getAgentsByOrganization(@RequestParam("org") String organizationId) {
        return service.getAgentsByOrganization(organizationId);
    }

    @GetMapping(value = {"/agents"}, params = {"org", "with_unbounded"})
    public List<ImgAgentListDto> getAgentsByOrganizationWithUnbounded(@RequestParam("org") String organizationId) {
        return service.getAgentsByOrganizationWithUnbounded(organizationId);
    }


    @GetMapping({"/agents/{id}"})
    public ImgAgentItemDto getAgentsById(@PathVariable("id") String agentId) {
        return service.getAgent(agentId);
    }

    @PostMapping({"/agents", "/agents/"})
    public ResponseEntity<?> addAgent(@Valid @RequestBody ImgAgentListDto dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.addAgent(dto));
    }

    @PutMapping({"/agents/{id}"})
    public ImgAgentItemDto updateAgent(@PathVariable(name = "id") String agentId, @Valid @RequestBody ImgAgentItemDto dto) {
        return service.updateAgent(agentId, dto);
    }


    @DeleteMapping({"/agents/{id}"})
    public ResponseEntity<?> deleteAgentsById(@PathVariable("id") String agentId) {
        service.deleteAgent(agentId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/agents/{id}/unbind")
    public ImgAgentItemDto unbindAgentFromOrg(@PathVariable("id") String agentId) {
        return service.unbindAgent(agentId);
    }

    @PutMapping(value = "/agents/{id}/bind", params = {"org"})
    public ImgAgentItemDto bindAgentToOrg(
            @PathVariable("id") String agentId,
            @RequestParam(name = "org") String orgId) {
        return service.bindAgent(agentId, orgId);
    }

    @GetMapping("/agents/{id}/places")
    public List<ImgPlaceListDto>  getPlacesForAgent(@PathVariable(name = "id") String agentId) {
        return service.getPlacesForAgent(agentId);
    }

    @GetMapping({"/configs/{id}"})
    ImgAgentConfigDto getAgentConfig(@PathVariable(name = "id") String agentId) {
        return service.getAgentConfig(agentId);
    }
}
