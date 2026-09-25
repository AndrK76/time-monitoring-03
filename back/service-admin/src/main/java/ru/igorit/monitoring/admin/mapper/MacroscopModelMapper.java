package ru.igorit.monitoring.admin.mapper;

import org.mapstruct.Condition;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;
import ru.igorit.monitoring.common.util.Md5Hasher;
import ru.igorit.monitoring.common.util.TimeUtils;
import ru.igorit.monitoring.lib.dto.macroscop.*;
import ru.igorit.monitoring.lib.persistence.entity.macroscop.*;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;

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
    MacroscopServerCredentials toServerCredentials(MacroscopAgentConfigDto config);

    default MacroscopServerInfoDto toDto(MacroscopServerInfo entity) {
        if (entity == null) return null;

        return MacroscopServerInfoDto.builder()
                .id(entity.getId())
                .version(entity.getVersion())
                .responseDate(TimeUtils.offsetToZonedWithTz(entity.getResponseDate(), entity.getTz()))
                .tz(TimeUtils.stringToZoneOffset(entity.getTz()))
                .useTz(Boolean.TRUE.equals(entity.getUseTz()))
                .build();
    }

    @Mapping(target = "responseDate", source = "responseDate", qualifiedByName = "zonedToOffsetDateTime")
    @Mapping(target = "tz", source = "tz", qualifiedByName = "zoneOffsetToString")
    MacroscopServerInfo fromDto(MacroscopServerInfoDto dto);

    @Mapping(target = "archiveMode", source = "archiveMode", qualifiedByName = "archiveModeToString")
    @Mapping(target = "tz", source = "tz", qualifiedByName = "stringToZoneOffset")
    MacroscopChannelDto toDto(MacroscopChannel entity);


    @Named("hashPassword")
    default String hashPassword(String password) {
        return Md5Hasher.md5HashUtf(password);
    }

    @Condition
    default boolean isServerInfoNotEmpty(MacroscopServerInfo entity) {
        return entity != null && !entity.isEmpty();
    }

    @Named("entityToResponseDate")
    default ZonedDateTime entityToResponseDate(MacroscopServerInfo entity) {
        return TimeUtils.offsetToZonedWithTz(entity.getResponseDate(), entity.getTz());
    }

    @Named("offsetDateTimeToZoned")
    default ZonedDateTime offsetDateTimeToZoned(OffsetDateTime odt) {
        return TimeUtils.offsetToZoned(odt);
    }

    @Named("zonedToOffsetDateTime")
    default OffsetDateTime zonedToOffsetDateTime(ZonedDateTime zdt) {
        return TimeUtils.zonedToOffset(zdt);
    }

    @Named("stringToZoneOffset")
    default ZoneOffset stringToZoneOffset(String s) {
        return TimeUtils.stringToZoneOffset(s);
    }

    @Named("zoneOffsetToString")
    default String zoneOffsetToString(ZoneOffset z) {
        return TimeUtils.zoneOffsetToString(z);
    }

    @Named("archiveModeToString")
    default String archiveModeToString(MacroscopArchiveMode mode) {
        return mode == null ? null : mode.name();
    }




}
