// service-admin/src/main/java/ru/igorit/monitoring/admin/service/AdminUserCacheService.java
package ru.igorit.monitoring.admin.service;

import ru.igorit.monitoring.common.dto.UserContext;
import ru.igorit.monitoring.common.dto.UserUpdatedEvent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
@Slf4j
public class AdminUserCacheService {

    private final Map<String, UserUpdatedEvent> userCache = new ConcurrentHashMap<>();

    public void updateUser(UserUpdatedEvent event, UserContext userContext, String sourceService) {
        userCache.put(event.getUserId(), event);
        log.info("User cached: {} (fullUpdate={})", event.getUsername(), event.isFullUpdate());
    }

    public UserUpdatedEvent getUser(String userId) {
        return userCache.get(userId);
    }
}