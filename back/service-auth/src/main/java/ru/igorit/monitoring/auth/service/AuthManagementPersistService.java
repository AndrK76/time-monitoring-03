package ru.igorit.monitoring.auth.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import ru.igorit.monitoring.persistence.entity.auth.Permission;
import ru.igorit.monitoring.persistence.entity.auth.Role;
import ru.igorit.monitoring.persistence.entity.auth.User;
import ru.igorit.monitoring.auth.repository.PermissionRepository;
import ru.igorit.monitoring.auth.repository.RoleRepository;
import ru.igorit.monitoring.auth.repository.UserRepository;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthManagementPersistService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;

    private final JdbcTemplate jdbcTemplate;

    @PersistenceContext
    private EntityManager entityManager;

    public List<User> findAllUsers() {
        return userRepository.findAll();
    }

    public Optional<User> findByUsername(String userName) {
        return userRepository.findByUsername(userName);
    }

    public Optional<User> findUserById(String id) {
        return userRepository.findById(id);
    }


    public User saveUser(User user) {
        return userRepository.save(user);
    }

    public void updateUserRoles(User user, List<String> newRoleNames, String updaterId) {

        String userId = user.getId();
        List<String> currentRoleIds = jdbcTemplate.queryForList(
                "SELECT role_id FROM user_roles WHERE user_id = ?",
                String.class, userId);

        Set<String> newRoleNamesSet = new HashSet<>(newRoleNames);
        List<Role> newRoles = roleRepository.findByNameIn(new ArrayList<>(newRoleNamesSet));
        Set<String> newRoleIds = newRoles.stream().map(Role::getId).collect(Collectors.toSet());

        Set<String> toAdd = new HashSet<>(newRoleIds);
        currentRoleIds.forEach(toAdd::remove);

        Set<String> toRemove = new HashSet<>(currentRoleIds);
        toRemove.removeAll(newRoleIds);
        if (!toAdd.isEmpty() || !toRemove.isEmpty()) {
            entityManager.flush();
        }

        if (!toAdd.isEmpty()) {
            String sqlInsert =
                    "INSERT INTO user_roles (user_id, role_id, created_by) "
                            + "VALUES (?, ?, ?)";
            for (String roleId : toAdd) {
                jdbcTemplate.update(sqlInsert, userId, roleId, updaterId);
            }
            log.info("Added roles {} to user {}", toAdd, userId);
        }

        if (!toRemove.isEmpty()) {
            String sqlDelete = "DELETE FROM user_roles WHERE user_id = ? AND role_id IN (?)";
            // Для IN с несколькими значениями используем параметризованный запрос с коллекцией
            jdbcTemplate.update(
                    "DELETE FROM user_roles WHERE user_id = ? AND role_id IN ("
                            + toRemove.stream().map(id -> "?").collect(Collectors.joining(",")) + ")",
                    rs -> {
                        int i = 1;
                        rs.setString(i++, userId);
                        for (String roleId : toRemove) {
                            rs.setString(i++, roleId);
                        }
                    }
            );
            log.info("Removed roles {} from user {}", toRemove, userId);
        }

        if (!toAdd.isEmpty() || !toRemove.isEmpty()) {
            entityManager.clear();
        }
    }



    public List<Role> findAllRoles() {
        return roleRepository.findAll();
    }

    public Optional<Role> findRoleById(String id) {
        return roleRepository.findById(id);
    }

    public List<Role> findRoleByNameIn(List<String> roleNames) {
        return roleRepository.findByNameIn(roleNames);
    }

    public Role saveRole(Role role) {
        return roleRepository.save(role);
    }

    public void deleteRole(Role role) {
        roleRepository.delete(role);
    }


    public void updateRolePermissions(Role role, List<String> newPermissionNames, String updaterId) {

        String roleId = role.getId();
        List<String> currentPermissionIds = jdbcTemplate.queryForList(
                "SELECT permission_id FROM role_permissions WHERE role_id = ?",
                String.class, roleId);

        Set<String> newPermissionNamesSet = new HashSet<>(newPermissionNames);
        List<Permission> newPermissions = permissionRepository.findByNameIn(new ArrayList<>(newPermissionNamesSet));
        Set<String> newPermissionIds = newPermissions.stream().map(Permission::getId).collect(Collectors.toSet());

        Set<String> toAdd = new HashSet<>(newPermissionIds);
        currentPermissionIds.forEach(toAdd::remove);

        Set<String> toRemove = new HashSet<>(currentPermissionIds);
        toRemove.removeAll(newPermissionIds);
        if (!toAdd.isEmpty() || !toRemove.isEmpty()) {
            entityManager.flush();
        }

        if (!toAdd.isEmpty()) {
            String sqlInsert =
                    "INSERT INTO role_permissions (role_id, permission_id, created_by) "
                            + "VALUES (?, ?, ?)";
            for (String permissionId : toAdd) {
                jdbcTemplate.update(sqlInsert, roleId, permissionId, updaterId);
            }
            log.info("Added permissions {} to role {}", toAdd, roleId);
        }

        if (!toRemove.isEmpty()) {
            String sqlDelete = "DELETE FROM role_permissions WHERE role_id = ? AND permission_id IN (?)";
            jdbcTemplate.update(
                    "DELETE FROM role_permissions WHERE role_id = ? AND permission_id IN ("
                            + toRemove.stream().map(id -> "?").collect(Collectors.joining(",")) + ")",
                    rs -> {
                        int i = 1;
                        rs.setString(i++, roleId);
                        for (String permissionId : toRemove) {
                            rs.setString(i++, permissionId);
                        }
                    }
            );
            log.info("Removed permissions {} from role {}", toRemove, roleId);
        }

        if (!toAdd.isEmpty() || !toRemove.isEmpty()) {
            entityManager.clear();
        }
    }

    public List<Permission> findPermissionByNameIn(List<String> permissionNames) {
        return permissionRepository.findByNameIn(permissionNames);
    }


    public List<Permission> findAllPermissions() {
        return permissionRepository.findAll();
    }



}
