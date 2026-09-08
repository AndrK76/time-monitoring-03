package ru.igorit.monitoring.lib.persistence.repository.crm;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.igorit.monitoring.lib.persistence.entity.crm.CrmOrganization;

public interface CrmOrganizationRepository extends JpaRepository<CrmOrganization, String> {
}