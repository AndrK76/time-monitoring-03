package ru.igorit.monitoring.admin.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import ru.igorit.monitoring.admin.service.MacroscopManageService;
import ru.igorit.monitoring.common.dto.common.BinaryContent;
import ru.igorit.monitoring.lib.dto.macroscop.*;
import ru.igorit.monitoring.lib.persistence.entity.macroscop.MacroscopEvtAgentMode;

import java.time.OffsetDateTime;
import java.time.ZonedDateTime;
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
    public MacroscopEvtAgentConfigDto bindEvtToConfig(@PathVariable("id") String agentId,
                                                      @RequestParam(name = "cfg") String configId) {
        return service.bindEvtConfig(agentId, configId);
    }

    @PutMapping(value = "/evt-configs/{id}/unbind")
    public MacroscopEvtAgentConfigDto unbindEvtFromConfig(@PathVariable("id") String agentId) {
        return service.unbindEvtConfig(agentId);
    }

    @GetMapping({"/img-configs/{id}"})
    public MacroscopImgAgentConfigDto getImgConfig(@PathVariable("id") String agentId) {
        return service.getImgConfig(agentId);
    }

    @PutMapping({"/img-configs/{id}"})
    public MacroscopImgAgentConfigDto updateImgConfig(@PathVariable("id") String agentId,
                                                      @Valid @RequestBody MacroscopImgAgentConfigDto dto) {
        return service.updateImgConfig(agentId, dto);
    }


    @PutMapping(value = "/img-configs/{id}/bind", params = {"cfg"})
    public MacroscopImgAgentConfigDto bindImgToConfig(@PathVariable("id") String agentId,
                                                      @RequestParam(name = "cfg") String configId) {
        return service.bindImgConfig(agentId, configId);
    }

    @PutMapping(value = "/img-configs/{id}/unbind")
    public MacroscopImgAgentConfigDto unbindImgFromConfig(@PathVariable("id") String agentId) {
        return service.unbindImgConfig(agentId);
    }

    @GetMapping(value = {"/img-agents/{id}/places"})
    public List<MacroscopImgPlaceListDto> getImgPlacesForAgent(
            @PathVariable(name = "id") String agentId,
            @RequestParam(name = "show-deleted", required = false, defaultValue = "false") boolean showDeleted) {
        return service.getImgPlacesForAgent(agentId, showDeleted);
    }

    @PostMapping("/img-agents/{id}/places")
    public MacroscopImgPlaceDto addImgPlaceByAgent(
            @PathVariable(name = "id") String agentId,
            @Valid @RequestBody MacroscopImgPlaceDto dto) {
        return service.addImgPlaceByAgent(agentId, dto);
    }

    @GetMapping("/img-agents/{id}/actual-channels")
    public List<MacroscopChannelListDto> getActualChannelsForAgent(@PathVariable(name = "id") String agentId) {
        return service.getActualChannelsForAgent(agentId);
    }

    @GetMapping("/img-places/{id}")
    public MacroscopImgPlaceDto getImgPlace(@PathVariable(name = "id") String id) {
        return service.getImgPlace(id);
    }

    @DeleteMapping("/img-places/{id}")
    public ResponseEntity<?> deleteImgPlace(@PathVariable(name = "id") String id) {
        service.markPlaceAsDeleted(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/img-places/{id}/restore-deleted")
    public MacroscopImgPlaceDto restoreImgPlace(@PathVariable(name = "id") String id) {
        return service.restoreDeletedPlace(id);
    }

    @PutMapping("/img-places/{id}")
    public MacroscopImgPlaceDto updateImgPlace(
            @PathVariable(name = "id") String id,
            @Valid @RequestBody MacroscopImgPlaceDto dto) {
        return service.updateImgPlace(id, dto);
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

    @GetMapping({"/event-types", "/event-types/"})
    public List<MacroscopEventTypeDto> getEventTypes() {
        return service.getEventTypes();
    }

    @PutMapping({"/event-types", "/event-types/"})
    List<MacroscopEventTypeDto> updateEventTypes(
            @Valid @RequestBody List<MacroscopEventTypeDto> dto) {
        return service.updateEventTypes(dto);
    }


    @GetMapping("/misc/configs/{id}/server-info")
    public MacroscopDataResponse<MacroscopServerInfoDto> getServerInfo(@PathVariable("id") String configId) {
        return service.getServerInfo(configId);
    }

    @GetMapping("/misc/activity-event-types")
    public List<MacroscopActivityEventTypeDto> getActivityEventTypes() {
        return service.getActivityEventTypes();
    }

    @GetMapping("/misc/archive-modes")
    public List<MacroscopArchiveModeDto> getArchiveModes() {
        return service.getArchiveModes();
    }

    @GetMapping("/misc/evt-agent-modes")
    public List<MacroscopEvtAgentModeDto> getEvtAgentModes() {
        return service.getEvtAgentModes();
    }

    @PostMapping("/misc/server-info")
    public MacroscopDataResponse<MacroscopServerInfoDto> getServerInfoByCreds(
            @Valid @RequestBody MacroscopServerCredentials creds) {
        return service.getServerInfoByCreds(creds);
    }

    @GetMapping("/misc/configs/{id}/channels")
    public MacroscopDataResponse<List<MacroscopChannelDto>> getAllowedChannels(@PathVariable("id") String configId) {
        return service.getAllowedChannels(configId);
    }

    @GetMapping("/misc/configs/{id}/channels/{channelId}/current-screenshot")
    public ResponseEntity<?> getCurrentScreenshot(
            @PathVariable("id") String configId,
            @PathVariable("channelId") String channelId
    ) {
        var result = service.getCurrentScreenShotOnChannel(configId, channelId);
        return macroscopResultToResponseEntity(result);
    }

    @GetMapping("/misc/configs/{id}/channels/{channelId}/last-archive-screenshot")
    public ResponseEntity<?> getlastArchiveScreenshot(
            @PathVariable("id") String configId,
            @PathVariable("channelId") String channelId
    ) {
        var result = service.getLastArchiveScreenShotOnChannel(configId, channelId);
        return macroscopResultToResponseEntity(result);
    }

    @GetMapping("/misc/configs/{id}/event-types")
    public MacroscopDataResponse<List<MacroscopEventTypeDto>> getMacroscopEventTypes(@PathVariable("id") String configId) {
        return service.getMacroscopEventTypes(configId);
    }

    @GetMapping(value = "/misc/configs/{id}/channels/{channelId}/places",
            params = "mode=" + MacroscopEvtAgentMode.NAME_BY_MOVING_DETECTOR)
    public MacroscopDataResponse<List<MacroscopEvtPlaceDto>> getEvtPlacesInDetectorModeForConfigAndChannel(
            @PathVariable(name = "id") String configId, @PathVariable(name = "channelId") String channelId
    ) {
        return service.getEvtPlacesInDetectorModeForConfigAndChannel(configId, channelId);
    }

    @GetMapping(value = "/misc/configs/{id}/channels/{channelId}/places",
            params = "mode=" + MacroscopEvtAgentMode.NAME_BY_ANALYTIC)
    public MacroscopDataResponse<MacroscopEvtActionPlacesResponseDto> getEvtPlacesInActionModeForChannel(
            @PathVariable(name = "id") String configId, @PathVariable(name = "channelId") String channelId,
            @RequestParam(name = "before", required = false) OffsetDateTime before) {
        return service.getEvtPlacesInActionModeForChannel(configId, channelId,
                before == null ? null : before.toZonedDateTime());
    }

    private ResponseEntity<?> macroscopResultToResponseEntity(MacroscopDataResponse<BinaryContent> result) {
        if (!result.isSuccess() || result.getData() == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    result.getErrorMessage() != null ? result.getErrorMessage() : "Macroscop error");
        }

        var data = result.getData();
        return ResponseEntity.status(HttpStatus.OK)
                .contentType(MediaType.parseMediaType(data.getContentType()))
                .contentLength(data.getData().length)
                .body(data.getData());
    }


}
