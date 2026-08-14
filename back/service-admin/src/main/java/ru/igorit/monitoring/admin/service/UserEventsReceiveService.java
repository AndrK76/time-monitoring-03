package ru.igorit.monitoring.admin.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.igorit.monitoring.admin.mapper.UserEventCommandMapper;
import ru.igorit.monitoring.admin.repository.AppUserRepository;
import ru.igorit.monitoring.common.dto.command.auth.UserContextDto;
import ru.igorit.monitoring.common.dto.command.auth.UserCreatedEventCommandDto;
import ru.igorit.monitoring.common.dto.command.auth.UserInfoUpdatedEventCommandDto;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserEventsReceiveService {
    private final AppUserRepository repo;
    private final UserEventCommandMapper mapper;

    @Transactional
    public void updateUser(UserInfoUpdatedEventCommandDto event, UserContextDto userContextDto, String sourceService) {
        var evtUser = mapper.fromChangeEvent(event);
        repo.findById(evtUser.getId()).ifPresentOrElse(
                usr -> {
                    usr.fillFrom(evtUser);
                    repo.save(usr);
                    log.debug("User updated: {}, full={}", event.getUsername(), event.isFullUpdate());
                },
                () -> {
                    repo.save(evtUser);
                    log.debug("User created: {}, full={}", event.getUsername(), event.isFullUpdate());
                });
    }

    @Transactional
    public void createUser(UserCreatedEventCommandDto event, UserContextDto userContextDto, String sourceService) {
        var evtUser = mapper.fromCreateEvent(event);
        repo.findById(evtUser.getId()).ifPresentOrElse(usr ->
                        log.debug("User exists: {}", event.getUsername()),
                () -> {
                    repo.save(evtUser);
                    log.debug("User created: {}", event.getUsername());
                });

    }
}
