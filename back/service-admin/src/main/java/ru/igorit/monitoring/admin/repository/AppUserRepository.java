package ru.igorit.monitoring.admin.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import ru.igorit.monitoring.persistence.entity.admin.AppUser;

@Repository
public interface AppUserRepository extends JpaRepository<AppUser, String> {

}