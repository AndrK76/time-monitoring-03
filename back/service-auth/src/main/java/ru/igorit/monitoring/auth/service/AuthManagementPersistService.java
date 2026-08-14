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

    public User saveUser(User user) {
        log.debug("repo before save: isApproved={}", user.getIsApproved());
        User res = userRepository.save(user);
        //entityManager.flush();
        log.debug("repo after save: isApproved={}", res.getIsApproved());
        return res;
    }

    public List<Role> findAllRoles() {
        return roleRepository.findAll();
    }

    public List<Permission> findAllPermissions() {
        return permissionRepository.findAll();
    }

    public Optional<User> findByUsername(String userName) {
        return userRepository.findByUsername(userName);
    }

    public Optional<User> findById(String id) {
        return userRepository.findById(id);
    }

    public List<Role> findByNameIn(List<String> roleNames) {
        return roleRepository.findByNameIn(roleNames);
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


}
