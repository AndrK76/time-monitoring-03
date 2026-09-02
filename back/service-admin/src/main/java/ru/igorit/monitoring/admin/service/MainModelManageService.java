package ru.igorit.monitoring.admin.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import ru.igorit.monitoring.admin.dto.OrganizationItemDto;
import ru.igorit.monitoring.admin.dto.OrganizationListDto;
import ru.igorit.monitoring.admin.mapper.MainModelMapper;
import ru.igorit.monitoring.admin.repository.AppUserRepository;
import ru.igorit.monitoring.admin.repository.OrganizationRepository;
import ru.igorit.monitoring.admin.repository.UserOrganizationRepository;
import ru.igorit.monitoring.persistence.entity.admin.AppUser;
import ru.igorit.monitoring.persistence.entity.admin.Organization;
import ru.igorit.monitoring.persistence.entity.admin.UserOrganization;
import ru.igorit.monitoring.web.dto.UserListItemDto;

import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static ru.igorit.monitoring.security.util.AuthInfoUtils.extractUserId;
import static ru.igorit.monitoring.security.util.AuthInfoUtils.getCurrentAuth;

@Service
@RequiredArgsConstructor
@Log4j2
public class MainModelManageService {
    private final OrganizationRepository organizationRepo;
    private final UserOrganizationRepository userOrganizationRepo;
    private final AppUserRepository userRepo;
    private final MainModelMapper mapper;

    @Transactional(readOnly = true)
    public List<OrganizationListDto> getOrganizations() {
        return organizationRepo.findAll().stream().map(mapper::toListDto).toList();
    }

    @PreAuthorize("hasAnyAuthority('SUPERUSER')")
    @Transactional(readOnly = true)
    public OrganizationItemDto getOrganization(String id) {
        Organization org = organizationRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organization not found"));
        return mapper.toItemDto(org);
    }

    @PreAuthorize("hasAnyAuthority('SUPERUSER')")
    @Transactional()
    public OrganizationListDto addOrganization(OrganizationListDto item) {
        String creatorId = extractUserId(getCurrentAuth());
        var org = mapper.fromListDto(item);
        org.setCreatedBy(creatorId);
        org.setId(null);
        return mapper.toListDto(organizationRepo.save(org));
    }

    @PreAuthorize("hasAnyAuthority('SUPERUSER')")
    @Transactional
    public OrganizationItemDto updateOrganization(String id, OrganizationItemDto dto) {
        String updaterId = extractUserId(getCurrentAuth());

        Organization existing = organizationRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organization not found"));

        existing.fillFrom(mapper.fromListDto(mapper.toShortDto(dto)));
        existing.setUpdatedBy(updaterId);

        if (dto.getUsers() != null) {

            Set<String> curUserIds = mapper.toUserIds(existing);
            Set<String> newUserIds = mapper.toUserIds(dto);
            Set<String> toAdd = new HashSet<>(newUserIds);
            toAdd.removeAll(curUserIds);
            Set<String> toRemove = new HashSet<>(curUserIds);
            toRemove.removeAll(newUserIds);

            if (!toRemove.isEmpty()) {
                existing.getUsers().removeIf(uo -> toRemove.contains(uo.getUser().getId()));
            }
            if (!toAdd.isEmpty()) {
                List<AppUser> usersToAdd = userRepo.findAllById(toAdd);
                if (usersToAdd.size() != toAdd.size()) {
                    log.error("Some users not found");
                }
                usersToAdd.forEach(user -> existing.getUsers().add(UserOrganization.create(user, existing, updaterId)));
            }
        }

        Organization saved = organizationRepo.save(existing);
        return mapper.toItemDto(saved);
    }

    @PreAuthorize("hasAnyAuthority('SUPERUSER')")
    @Transactional
    public void deleteOrganization(String id) {
        userOrganizationRepo.deleteByOrganizationId(id);
        organizationRepo.deleteById(id);
    }

    @PreAuthorize("hasAnyAuthority('SUPERUSER')")
    @Transactional(readOnly = true)
    public List<UserListItemDto> getUsers() {
        return userRepo.findAll().stream().map(mapper::toListDto).toList();
    }


}
