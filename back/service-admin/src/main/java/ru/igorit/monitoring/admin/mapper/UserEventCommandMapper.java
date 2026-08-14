package ru.igorit.monitoring.admin.mapper;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;
import ru.igorit.monitoring.common.dto.command.auth.UserCreatedEventCommandDto;
import ru.igorit.monitoring.common.dto.command.auth.UserInfoUpdatedEventCommandDto;
import ru.igorit.monitoring.persistence.entity.admin.AppUser;

@Mapper(componentModel = "spring")
public interface UserEventCommandMapper {
    @Mapping(target = "id", source = "userId")
    @Mapping(target = "valid", ignore = true)
    @Mapping(target = "roles", ignore = true)
    AppUser fromCreateEvent(UserCreatedEventCommandDto cmd);

    @Mapping(target = "id", source = "userId")
    @Mapping(target = "valid", expression = "java(cmd.isActive() && cmd.isApproved())")
    @Mapping(target = "roles", source = "roles", qualifiedByName = "arrToString")
    AppUser fromChangeEvent(UserInfoUpdatedEventCommandDto cmd);

    @Named("arrToString")
    default String arrToString(String[] items) {
        if (items == null || items.length == 0) {
            return "";
        }
        return String.join(",", items);
    }

}
