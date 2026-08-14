package ru.igorit.monitoring.persistence.repository.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import ru.igorit.monitoring.persistence.entity.auth.User;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, String> {

    Optional<User> findByUsername(String username);

    Optional<User> findByEmail(String email);

    @Query("SELECT u FROM User u JOIN u.authProviders p WHERE p.providerName = :providerName AND p.providerUserId = :providerUserId")
    Optional<User> findByProvider(@Param("providerName") String providerName, @Param("providerUserId") String providerUserId);

    boolean existsByUsername(String username);

    boolean existsByEmail(String email);
}