package ru.igorit.monitoring.admin.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import ru.igorit.monitoring.admin.service.StructManageService;
import ru.igorit.monitoring.lib.dto.OrgStructListDto;

import java.util.List;

@RestController
@RequestMapping("/api/v1/dict")
@RequiredArgsConstructor
public class MainDictController {
    private final StructManageService structService;

    @GetMapping({"/org","/org/"})
    List<OrgStructListDto> getAllowedOrganizations() {
        return structService.getAllowedOrganizations();
    }

    @GetMapping("/org/{id}")
    OrgStructListDto getOrganization(@PathVariable("id") String id) {
        return structService.getOrganization(id);
    }

    @PostMapping("/org/{id}")
    OrgStructListDto updateOrganization(@PathVariable("id") String id, @RequestBody OrgStructListDto data) {
        return structService.updateOrganization(id, data);
    }
}
