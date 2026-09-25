package ru.igorit.monitoring.admin.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import ru.igorit.monitoring.admin.service.MacroscopManageService;
import ru.igorit.monitoring.lib.dto.macroscop.*;
import ru.igorit.monitoring.lib.dto.yclients.YClientsServiceCategoryDto;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/macroscop")
@Log4j2
public class MacroscopManageController {
    private final MacroscopManageService service;

    @GetMapping({"/evt-configs/{id}"})
    public MacroscopEvtAgentConfigDto getEvtConfig(@PathVariable("id") String agentId) {
        return service.getEvtConfig(agentId);
    }

    @PutMapping({"/evt-configs/{id}"})
    public MacroscopEvtAgentConfigDto updateEvtConfig(@PathVariable("id") String agentId,
                                                      @Valid @RequestBody MacroscopEvtAgentConfigDto dto) {
        return service.updateEvtConfig(agentId, dto);
    }


    @PutMapping(value = "/evt-configs/{id}/bind", params = {"cfg"})
    public MacroscopEvtAgentConfigDto bindToConfig(@PathVariable("id") String agentId,
                                                   @RequestParam(name = "cfg") String configId) {
        return service.bindEvtConfig(agentId, configId);
    }

    @PutMapping(value = "/evt-configs/{id}/unbind")
    public MacroscopEvtAgentConfigDto unbindToConfig(@PathVariable("id") String agentId) {
        return service.unbindEvtConfig(agentId);
    }

    @GetMapping({"/configs", "/configs/"})
    public List<MacroscopAgentConfigListDto> getConfigs() {
        return service.getConfigs();
    }


    @GetMapping({"/configs/{id}"})
    public MacroscopAgentConfigDto getConfig(@PathVariable("id") String configId) {
        return service.getConfig(configId);
    }

    @PostMapping({"/configs", "/configs/"})
    public ResponseEntity<?> newConfig() {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.newConfig());
    }

    @PutMapping({"/configs/{id}"})
    public MacroscopAgentConfigDto updateConfig(
            @PathVariable("id") String configId,
            @Valid @RequestBody MacroscopAgentConfigDto dto) {
        return service.updateConfig(configId, dto);
    }

    @DeleteMapping({"/configs/{id}"})
    public ResponseEntity<?> deleteConfig(@PathVariable("id") String configId) {
        service.deleteConfig(configId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/configs/{id}/channels")
    public List<MacroscopChannelDto> getChannelsForConfig(@PathVariable("id") String configId) {
        return service.getChannelsForConfig(configId);
    }

    @PutMapping("/configs/{id}/channels")
    public List<MacroscopChannelDto> updateChannelsForConfig(
            @PathVariable("id") String configId,
            @RequestBody @Valid List<MacroscopChannelDto> dto) {
        return service.updateChannelsForConfig(configId, dto);
    }

    @GetMapping("/misc/configs/{id}/server-info")
    public MacroscopDataResponse<MacroscopServerInfoDto> getServerInfo(@PathVariable("id") String configId) {
        return service.getServerInfo(configId);
    }

    @GetMapping("/misc/configs/{id}/channels")
    public MacroscopDataResponse<List<MacroscopChannelDto>> getAllowedChannels(@PathVariable("id") String configId) {
        return service.getAllowedChannels(configId);
    }

    @PostMapping("/misc/server-info")
    public MacroscopDataResponse<MacroscopServerInfoDto> getServerInfoByCreds(
            @Valid @RequestBody MacroscopServerCredentials creds) {
        return service.getServerInfoByCreds(creds);
    }


}
