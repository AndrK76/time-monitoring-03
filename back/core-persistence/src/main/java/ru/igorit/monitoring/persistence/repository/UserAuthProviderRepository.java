package ru.igorit.monitoring.persistence.repository;

import ru.igorit.monitoring.persistence.entity.UserAuthProvider;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserAuthProviderRepository extends JpaRepository<UserAuthProvider, String> {

    Optional<UserAuthProvider> findByProviderNameAndProviderUserId(String providerName, String providerUserId);

    void deleteByUserIdAndProviderName(String userId, String providerName);
}