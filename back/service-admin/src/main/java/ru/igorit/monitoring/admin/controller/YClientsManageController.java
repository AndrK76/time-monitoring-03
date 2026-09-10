package ru.igorit.monitoring.admin.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import ru.igorit.monitoring.admin.service.YClientsManageService;
import ru.igorit.monitoring.lib.dto.yclients.YClientsAgentConfigDto;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/yc")
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
}
