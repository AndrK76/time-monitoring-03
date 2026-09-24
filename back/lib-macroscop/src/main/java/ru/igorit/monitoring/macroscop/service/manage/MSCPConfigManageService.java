package ru.igorit.monitoring.macroscop.service.manage;

import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;
import ru.igorit.monitoring.lib.dto.macroscop.MacroscopDataResponse;
import ru.igorit.monitoring.lib.dto.macroscop.MacroscopServerCredentials;
import ru.igorit.monitoring.lib.dto.macroscop.MacroscopServerInfo;
import ru.igorit.monitoring.macroscop.api.config.MacroscopApiProperties;
import ru.igorit.monitoring.macroscop.api.service.MacroscopApiClient;

@Service
@Log4j2
@RequiredArgsConstructor
public class MSCPConfigManageService {
    private final MacroscopApiProperties apiProperties;
    private final MacroscopApiClient apiClient;

    public MacroscopDataResponse<MacroscopServerInfo> getServerInfo(MacroscopServerCredentials creds) {
        return null;
    }
}
