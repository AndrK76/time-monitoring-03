package ru.igorit.monitoring.auth.repository;

import ru.igorit.monitoring.persistence.entity.auth.Permission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import ru.igorit.monitoring.persistence.entity.auth.Role;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface PermissionRepository extends JpaRepository<Permission, String> {

    Optional<Permission> findByName(String name);

    List<Permission> findByNameIn(Collection<String> names);
}