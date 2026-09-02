package ru.igorit.monitoring.admin.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import ru.igorit.monitoring.admin.dto.OrganizationItemDto;
import ru.igorit.monitoring.admin.dto.OrganizationListDto;
import ru.igorit.monitoring.admin.service.MainModelManageService;
import ru.igorit.monitoring.web.dto.UserListItemDto;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/main")
public class MainModelController {
    private final MainModelManageService service;

    @GetMapping({"organizations", "/organizations/",})
    public List<OrganizationListDto> getOrganizations() {
        return service.getOrganizations();
    }

    @GetMapping("/organizations/{id}")
    public OrganizationItemDto getOrganization(@PathVariable String id) {
        return service.getOrganization(id);
    }


    @PostMapping({"organizations", "/organizations/",})
    public ResponseEntity<?> addOrganization(@RequestBody OrganizationListDto item) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.addOrganization(item));
    }

    @PutMapping("/organizations/{id}")
    public OrganizationItemDto updateOrganization(@PathVariable String id,
                                                  @RequestBody OrganizationItemDto item) {
        return service.updateOrganization(id, item);
    }

    @DeleteMapping("/organizations/{id}")
    public ResponseEntity<?> deleteOrganization(@PathVariable String id) {
        service.deleteOrganization(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping({"/users","users/"})
    public List<UserListItemDto> getUsers() {
        return service.getUsers();
    }
}
