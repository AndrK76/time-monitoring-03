package ru.igorit.monitoring.persistence.repository.auth;

import ru.igorit.monitoring.persistence.entity.auth.Permission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PermissionRepository extends JpaRepository<Permission, String> {

    Optional<Permission> findByName(String name);
}