package ru.igorit.monitoring.monitoring.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.igorit.monitoring.common.dto.command.auth.OrganizationInfoChangedEventCommandDto;
import ru.igorit.monitoring.common.dto.command.auth.UserContextDto;
import ru.igorit.monitoring.lib.persistence.entity.common.Organization;
import ru.igorit.monitoring.lib.persistence.repository.common.OrganizationRepository;

import java.util.List;

@Service
@RequiredArgsConstructor
@Log4j2
public class DictEventsReceiveService {

    private final OrganizationRepository orgRepo;

    @Transactional
    public void applyOrgEvent(OrganizationInfoChangedEventCommandDto event, UserContextDto userContext, String sourceService) {
        try {
            var lstModify = List.of(OrganizationInfoChangedEventCommandDto.Mode.ADD,
                    OrganizationInfoChangedEventCommandDto.Mode.UPDATE,
                    OrganizationInfoChangedEventCommandDto.Mode.UPDATE_NAME);
            if (lstModify.contains(event.getMode())) {
                var src = orgRepo.findById(event.getOrgId()).orElse(new Organization(event.getOrgId()));
                src.setShortName(event.getShortName());
                src.setFullName(event.getFullName());
                orgRepo.save(src);
            } else if (event.getMode() == OrganizationInfoChangedEventCommandDto.Mode.DELETE) {
                orgRepo.deleteById(event.getOrgId());
            }
            log.info("OrganizationInfoChangedEvent with mode {} applied for org: {}", event.getMode(), event.getOrgId());
        } catch (Exception e) {
            log.error(e.getMessage());
            log.trace(e);
        }
    }
}
