package ru.igorit.monitoring.auth.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import ru.igorit.monitoring.persistence.entity.auth.UserAuthProvider;

import java.util.Optional;

@Repository
public interface UserAuthProviderRepository extends JpaRepository<UserAuthProvider, String> {

    Optional<UserAuthProvider> findByProviderNameAndProviderUserId(String providerName, String providerUserId);

    void deleteByUserIdAndProviderName(String userId, String providerName);
}