package ru.igorit.monitoring.auth.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.igorit.monitoring.auth.repository.AuthOrganizationRepository;
import ru.igorit.monitoring.common.dto.command.auth.OrganizationInfoChangedEventCommandDto;
import ru.igorit.monitoring.common.dto.command.auth.UserContextDto;
import ru.igorit.monitoring.persistence.entity.auth.AuthOrganization;
import ru.igorit.monitoring.persistence.entity.auth.User;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Log4j2
public class OrganizationEventsReceiveService {

    private final AuthOrganizationRepository authOrganizationRepository;

    private final AuthManagementPersistService persistService;

    @Transactional
    public void applyChangeEvent(OrganizationInfoChangedEventCommandDto event, UserContextDto userContext, String sourceService) {
        var existingUsers = persistService.getUsersByIds(
                persistService.getUserIdsByOrganizationId(event.getOrgId()));

        List<User> newUsers = event.getUsers() == null || event.getUsers().length == 0
                ? List.of()
                : persistService.getUsersByIds(Arrays.asList(event.getUsers()));

        var org = persistService.getOrganizationById(event.getOrgId()).orElse(new AuthOrganization(event.getOrgId()));
        org.setShortName(event.getShortName());
        org.setFullName(event.getFullName());
        persistService.saveOrganization(org);

        Set<String> existingIds = existingUsers.stream().map(User::getId).collect(Collectors.toSet());
        Set<String> newIds = newUsers.stream().map(User::getId).collect(Collectors.toSet());

        List<User> usersToSave = new ArrayList<>();

        existingUsers.stream()
                .filter(user -> !newIds.contains(user.getId()))
                .forEach(user -> {
                    user.getOrgIds().remove(event.getOrgId());
                    usersToSave.add(user);
                });

        newUsers.stream()
                .filter(user -> !existingIds.contains(user.getId()))
                .forEach(user -> {
                    user.getOrgIds().add(event.getOrgId());
                    usersToSave.add(user);
                });

        if (!usersToSave.isEmpty()) {
            persistService.saveUsers(usersToSave);
        }
        log.info("OrganizationInfoChangedEvent with mode {} applied for org: {}", event.getMode(), event.getOrgId());
    }
}
