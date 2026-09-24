package ru.igorit.monitoring.admin.mapper;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;
import ru.igorit.monitoring.common.util.Md5Hasher;
import ru.igorit.monitoring.lib.dto.macroscop.*;
import ru.igorit.monitoring.lib.persistence.entity.macroscop.MacroscopAgentConfig;
import ru.igorit.monitoring.lib.persistence.entity.macroscop.MacroscopCredentials;
import ru.igorit.monitoring.lib.persistence.entity.macroscop.MacroscopEvtAgentConfig;

@Mapper(componentModel = "spring")
public interface MacroscopModelMapper {
    MacroscopCredentialsDto toDto(MacroscopCredentials item);

    MacroscopCredentials fromDto(MacroscopCredentialsDto dto);

    MacroscopAgentConfigDto toDto(MacroscopAgentConfig item);

    MacroscopEvtAgentConfigDto toDto(MacroscopEvtAgentConfig item);

    MacroscopAgentConfigListDto toListDto(MacroscopAgentConfig item);

    @Mapping(target = "address", source = "config.serverAddress")
    @Mapping(target = "login", source = "config.credentials.login")
    @Mapping(target = "passwordHash", source = "config.credentials.password", qualifiedByName = "hashPassword")
    MacroscopServerCredentials toServerCredentials(MacroscopAgentConfig config);


    @Named("hashPassword")
    default String hashPassword(String password) {
        return Md5Hasher.md5HashUtf(password);
    }


}
