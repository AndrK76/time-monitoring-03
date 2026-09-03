package ru.igorit.monitoring.auth.repository;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import ru.igorit.monitoring.persistence.entity.auth.User;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, String> {

    Optional<User> findByUsername(String username);

    Optional<User> findByEmail(String email);

    @Query("SELECT u FROM User u JOIN u.authProviders p WHERE p.providerName = :providerName AND p.providerUserId = :providerUserId")
    Optional<User> findByProvider(@Param("providerName") String providerName, @Param("providerUserId") String providerUserId);

    boolean existsByUsername(String username);

    boolean existsByEmail(String email);

    @EntityGraph(attributePaths = {"orgIds"})
    List<User> findByIdIn(List<String> ids);

    @Query("SELECT u FROM User u " +
            "LEFT JOIN FETCH u.orgIds " +
            "LEFT JOIN FETCH u.roles r " +
            "LEFT JOIN FETCH r.permissions " +
            "WHERE u.username = :username")
    Optional<User> findUserWithFullDetails(@Param("username") String username);

}