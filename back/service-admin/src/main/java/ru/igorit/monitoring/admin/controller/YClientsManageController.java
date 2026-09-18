package ru.igorit.monitoring.admin.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.ResponseEntity;
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

    @GetMapping("/agents/{id}/service-categories")
    public List<YClientsServiceCategoryDto> getServiceCategoriesForAgent(@PathVariable("id") String agentId) {
        return service.getServiceCategoriesForAgent(agentId);
    }

    @PutMapping("/agents/{id}/service-categories")
    public List<YClientsServiceCategoryDto> updateServiceCategoriesForAgent(
            @PathVariable("id") String agentId,
            @Valid @RequestBody List<YClientsServiceCategoryDto> request) {
        return service.updateServiceCategoriesForAgent(agentId, request);
    }

    @GetMapping("/agents/{id}/services")
    public List<YClientsServiceDto> getServicesForAgent(@PathVariable("id") String agentId) {
        return service.getServicesForAgent(agentId);
    }

    @PostMapping("/agents/{id}/services")
    public YClientsServiceDto addServicesForAgent(
            @PathVariable("id") String agentId,
            @Valid @RequestBody YClientsServiceDto request) {
        return service.addServiceForAgent(agentId, request);
    }

    @PutMapping("/agents/{agent}/services/{id}")
    public YClientsServiceDto updateServiceForAgent(
            @PathVariable("agent") String agentId,
            @PathVariable("id") String serviceId,
            @Valid @RequestBody YClientsServiceDto request) {
        return service.updateServiceForAgent(agentId, serviceId, request);
    }

    @DeleteMapping("/agents/{agent}/services/{id}")
    public ResponseEntity<?> deleteServiceForAgent(
            @PathVariable("agent") String agentId,
            @PathVariable("id") String serviceId) {
        service.deleteServiceForAgent(agentId, serviceId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/agents/{id}/places")
    public List<YClientsPlaceDto> getPlacesForAgent(@PathVariable("id") String agentId) {
        return service.getPlacesForAgent(agentId);
    }

    @PostMapping("/agents/{id}/places")
    public YClientsPlaceDto addPlacesForAgent(
            @PathVariable("id") String agentId,
            @Valid @RequestBody YClientsPlaceDto request) {
        return service.addPlacesForAgent(agentId, request);
    }

    @PutMapping("/agents/{agent}/places/{id}")
    public YClientsPlaceDto updatePlaceForAgent(
            @PathVariable("agent") String agentId,
            @PathVariable("id") String serviceId,
            @Valid @RequestBody YClientsPlaceDto request) {
        return service.updatePlaceForAgent(agentId, serviceId, request);
    }

    @DeleteMapping("/agents/{agent}/places/{id}")
    public ResponseEntity<?> deletePlaceForAgent(
            @PathVariable("agent") String agentId,
            @PathVariable("id") String serviceId) {
        service.deletePlaceForAgent(agentId, serviceId);
        return ResponseEntity.noContent().build();
    }



    @PostMapping("/misc/get-token")
    public YClientsTokenResponseDto getClientToken(@Valid @RequestBody YClientsTokenRequestDto request) {
        log.debug("Start get client-token");
        var ret = service.getClientToken(request);
        log.debug("End get client-token: {}", ret);
        return ret;
    }

    @GetMapping("/misc/agent/{id}/allowed-orgs")
    public YClientsDataResponse<List<YClientsOrganizationDto>> getAllowedOrganizationsForAgent(@PathVariable(name = "id") String agentId) {
        return service.getAllowedOrganizationsForAgent(agentId);
    }

    @GetMapping("/misc/agent/{id}/org/{org}/service-categories")
    public YClientsDataResponse<List<YClientsServiceCategoryDto>> getAllowedServiceCategories
            (@PathVariable(name = "id") String agentId, @PathVariable(name = "org") Long orgId) {
        return service.getAllowedServiceCategories(agentId, orgId);
    }

    @GetMapping("/misc/agent/{id}/services")
    public YClientsDataResponse<List<YClientsServiceDto>> getAllowedServices
            (@PathVariable(name = "id") String agentId) {
        return service.getAllowedServices(agentId);
    }

    @GetMapping("/misc/agent/{id}/places")
    public YClientsDataResponse<List<YClientsPlaceDto>> getAllowedPlaces
            (@PathVariable(name = "id") String agentId) {
        return service.getAllowedPlaces(agentId);
    }
}
