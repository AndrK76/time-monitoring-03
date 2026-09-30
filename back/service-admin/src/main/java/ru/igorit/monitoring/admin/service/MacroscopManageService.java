package ru.igorit.monitoring.admin.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import ru.igorit.monitoring.admin.mapper.MacroscopModelMapper;
import ru.igorit.monitoring.common.dto.common.BinaryContent;
import ru.igorit.monitoring.common.util.Md5Hasher;
import ru.igorit.monitoring.common.util.TimeUtils;
import ru.igorit.monitoring.common.util.XorCipher;
import ru.igorit.monitoring.lib.dto.macroscop.*;
import ru.igorit.monitoring.lib.persistence.entity.common.Organization;
import ru.igorit.monitoring.lib.persistence.entity.evt.EvtAgent;
import ru.igorit.monitoring.lib.persistence.entity.evt.EvtAgentConfig;
import ru.igorit.monitoring.lib.persistence.entity.macroscop.*;
import ru.igorit.monitoring.lib.persistence.repository.macroscop.*;
import ru.igorit.monitoring.macroscop.service.manage.MSCPConfigManageService;
import ru.igorit.monitoring.security.util.SecurityAccessUtils;

import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static ru.igorit.monitoring.macroscop.api.config.MacroscopApiConstants.ALT_STREAM;
import static ru.igorit.monitoring.macroscop.api.config.MacroscopApiConstants.MAIN_STREAM;
import static ru.igorit.monitoring.security.util.AuthInfoUtils.extractUserId;
import static ru.igorit.monitoring.security.util.AuthInfoUtils.getCurrentAuth;

@Service
@RequiredArgsConstructor
@Log4j2
public class MacroscopManageService {
    @Value("${security.store.xor}")
    private String xorSecret;
    private final MacroscopModelMapper mapper;
    private final MacroscopEvtAgentConfigRepository evtConfigRepo;
    private final MacroscopImgAgentConfigRepository imgConfigRepo;
    private final MacroscopImgPlaceRepository imgPlaceRepo;
    private final MacroscopImgAgentRepository imgAgentRepo;
    private final MacroscopAgentConfigRepository configRepo;
    private final MacroscopChannelRepository channelRepo;
    private final ImgManageService imgService;
    private final EvtManageService evtService;
    private final SecurityAccessUtils sa;
    private final MSCPConfigManageService macroscopService;


    @Transactional(readOnly = true)
    @PreAuthorize("@securityAccessUtils.isAllowedAllActions()")
    public MacroscopEvtAgentConfigDto getEvtConfig(String agentId) {
        var ret = mapper.toDto(_getEvtConfig(agentId));
        if (ret != null && ret.getConfig() != null) {
            ret.setConfig(unmaskCreds(ret.getConfig()));
        }
        return ret;
    }

    @Transactional
    @PreAuthorize("@securityAccessUtils.isAllowedAllActions()")
    public MacroscopEvtAgentConfigDto updateEvtConfig(String agentId, MacroscopEvtAgentConfigDto dto) {
        if (dto == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Empty Macroscop config");
        }
        var ret = _getEvtConfig(agentId);
        assert ret != null;
        if (ret.getConfig() == null) {
            if (dto.getConfig() != null) {
                MacroscopAgentConfig cfg;
                if (dto.getConfig().getId() != null) {
                    cfg = _getConfig(dto.getConfig().getId());
                } else {
                    cfg = _newConfig();
                }
                ret.setConfig(cfg);
                ret.setUpdatedBy(extractUserId(getCurrentAuth()));
                ret = evtConfigRepo.saveAndFlush(ret);
                dto.setConfig(unmaskCreds(mapper.toDto(ret.getConfig())));
            }
        } else {
            if (dto.getConfig() == null || !Objects.equals(ret.getConfig().getId(), dto.getConfig().getId())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Incorrect Macroscop config");
            }
            dto.setConfig(_updateStoredConfig(dto.getConfig(), ret.getConfig()));
        }
        return dto;
    }

    @Transactional
    @PreAuthorize("@securityAccessUtils.isSuperUser()")
    public MacroscopEvtAgentConfigDto bindEvtConfig(String agentId, String configId) {
        var ret = _getEvtConfig(agentId);
        assert ret != null;
        if (ret.getConfig() != null) {
            if (!Objects.equals(ret.getConfig().getId(), configId)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Event config for agent already bounded");
            }
            return mapper.toDto(ret);
        }
        var cfg = _getConfig(configId);
        ret.setConfig(cfg);
        ret.setUpdatedBy(extractUserId(getCurrentAuth()));
        return mapper.toDto(evtConfigRepo.save(ret));
    }

    @Transactional
    @PreAuthorize("@securityAccessUtils.isSuperUser()")
    public MacroscopEvtAgentConfigDto unbindEvtConfig(String agentId) {
        var ret = _getEvtConfig(agentId);
        assert ret != null;
        if (ret.getConfig() != null) {
            ret.setConfig(null);
            ret.setUpdatedBy(extractUserId(getCurrentAuth()));
            return mapper.toDto(evtConfigRepo.save(ret));
        }
        return mapper.toDto(ret);
    }

    @Transactional(readOnly = true)
    @PreAuthorize("@securityAccessUtils.isAllowedAllActions()")
    public MacroscopImgAgentConfigDto getImgConfig(String agentId) {
        var ret = mapper.toDto(_getImgConfig(agentId));
        if (ret != null && ret.getConfig() != null) {
            ret.setConfig(unmaskCreds(ret.getConfig()));
        }
        return ret;
    }

    @Transactional
    @PreAuthorize("@securityAccessUtils.isAllowedAllActions()")
    public MacroscopImgAgentConfigDto updateImgConfig(String agentId, MacroscopImgAgentConfigDto dto) {
        if (dto == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Empty Macroscop config");
        }
        var ret = _getImgConfig(agentId);
        assert ret != null;
        if (ret.getConfig() == null) {
            if (dto.getConfig() != null) {
                MacroscopAgentConfig cfg;
                if (dto.getConfig().getId() != null) {
                    cfg = _getConfig(dto.getConfig().getId());
                } else {
                    cfg = _newConfig();
                }
                ret.setConfig(cfg);
                ret.setUpdatedBy(extractUserId(getCurrentAuth()));
                ret = imgConfigRepo.saveAndFlush(ret);
                dto.setConfig(unmaskCreds(mapper.toDto(ret.getConfig())));
            }
        } else {
            if (dto.getConfig() == null || !Objects.equals(ret.getConfig().getId(), dto.getConfig().getId())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Incorrect Macroscop config");
            }
            dto.setConfig(_updateStoredConfig(dto.getConfig(), ret.getConfig()));
        }
        return dto;
    }

    @Transactional
    @PreAuthorize("@securityAccessUtils.isSuperUser()")
    public MacroscopImgAgentConfigDto bindImgConfig(String agentId, String configId) {
        var ret = _getImgConfig(agentId);
        assert ret != null;
        if (ret.getConfig() != null) {
            if (!Objects.equals(ret.getConfig().getId(), configId)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Camera config for agent already bounded");
            }
            return mapper.toDto(ret);
        }
        var cfg = _getConfig(configId);
        ret.setConfig(cfg);
        ret.setUpdatedBy(extractUserId(getCurrentAuth()));
        return mapper.toDto(imgConfigRepo.save(ret));
    }

    @Transactional
    @PreAuthorize("@securityAccessUtils.isSuperUser()")
    public MacroscopImgAgentConfigDto unbindImgConfig(String agentId) {
        var ret = _getImgConfig(agentId);
        assert ret != null;
        if (ret.getConfig() != null) {
            ret.setConfig(null);
            ret.setUpdatedBy(extractUserId(getCurrentAuth()));
            return mapper.toDto(imgConfigRepo.save(ret));
        }
        return mapper.toDto(ret);
    }


    @Transactional(readOnly = true)
    @PreAuthorize("@securityAccessUtils.isAllowedAllActions()")
    public List<MacroscopImgPlaceListDto> getImgPlacesForAgent(String agentId) {
        var agent = imgService.getAgent(agentId);
        return imgPlaceRepo.findByAgentId(agentId).stream()
                .map(mapper::toListDto).toList();
    }

    @Transactional
    @PreAuthorize("@securityAccessUtils.isAllowedAllActions()")
    public MacroscopImgPlaceDto addImgPlaceByAgent(String agentId, MacroscopImgPlaceDto dto) {
        imgService.getAgent(agentId);
        var agent = imgAgentRepo.findById(agentId).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Agent not found"));
        var cfg = _getImgConfig(agentId);
        assert cfg != null;
        if (cfg.getConfig() == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Macroscop config for agent not bounded");
        }
        if (imgPlaceRepo.findByAgentId(agentId).stream()
                .anyMatch(f -> Objects.equals(dto.getMacroscopId(), f.getOrigChannelId()))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Place for channel =" + dto.getMacroscopId() + " already exists");
        }
        var channel = channelRepo.findByConfigIdAndMacroscopId(cfg.getConfig().getId(), dto.getMacroscopId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Channel not found"));
        var ret = new MacroscopImgPlace();
        ret.setName(dto.getName() == null ? channel.getName() : dto.getName());
        ret.setAgent(agent);
        ret.setPresent(channel.getExists() && channel.getEnabled());
        ret.setDeleted(false);
        ret.setUsed(channel.getUsed());
        ret.setChannel(channel);
        ret.setOrigChannelId(channel.getMacroscopId());
        ret.setCreatedBy(extractUserId(getCurrentAuth()));
        ret = imgPlaceRepo.saveAndFlush(ret);
        return mapper.toDto(ret);
    }


    @Transactional(readOnly = true)
    @PreAuthorize("@securityAccessUtils.isAllowedAllActions()")
    public MacroscopImgPlaceDto getImgPlace(String id) {
        var ret = imgPlaceRepo.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "place not found"));
        imgService.getAgent(ret.getAgent().getId());
        return mapper.toDto(ret);
    }

    @Transactional
    @PreAuthorize("@securityAccessUtils.isAllowedAllActions()")
    public MacroscopImgPlaceDto updateImgPlace(String id, MacroscopImgPlaceDto dto) {
        var ret = imgPlaceRepo.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "place not found"));
        imgService.getAgent(ret.getAgent().getId());
        ret.setName(dto.getName());
        ret.setUsed(dto.isUsed());
        ret.setUpdatedBy(extractUserId(getCurrentAuth()));
        ret = imgPlaceRepo.saveAndFlush(ret);
        return mapper.toDto(ret);
    }


    @Transactional(readOnly = true)
    @PreAuthorize("@securityAccessUtils.isSuperUser()")
    public List<MacroscopAgentConfigListDto> getConfigs() {
        return configRepo.findAll().stream().map(mapper::toListDto).toList();
    }

    @Transactional(readOnly = true)
    @PreAuthorize("@securityAccessUtils.isSuperUser()")
    public MacroscopAgentConfigDto getConfig(String configId) {
        return unmaskCreds(mapper.toDto(_getConfig(configId)));
    }

    @Transactional
    @PreAuthorize("@securityAccessUtils.isSuperUser()")
    public MacroscopAgentConfigDto newConfig() {
        return mapper.toDto(_newConfig());
    }

    @Transactional
    @PreAuthorize("@securityAccessUtils.isSuperUser()")
    public MacroscopAgentConfigDto updateConfig(String configId, MacroscopAgentConfigDto dto) {
        var stored = _getConfig(configId);
        if (dto == null || dto.getCredentials() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Incorrect request data");
        }
        if (!configId.equalsIgnoreCase(stored.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request Id not equal Macroscop config id=" + dto.getId());
        }
        return _updateStoredConfig(dto, stored);
    }

    @Transactional
    @PreAuthorize("@securityAccessUtils.isSuperUser()")
    public void deleteConfig(String configId) {
        configRepo.deleteById(configId);
    }


    @Transactional(readOnly = true)
    @PreAuthorize("@securityAccessUtils.isAllowedAllActions()")
    public List<MacroscopChannelDto> getChannelsForConfig(String configId) {
        _checkAllowedConfigByOrg(configId);
        return channelRepo.findByConfigId(configId).stream()
                .map(mapper::toDto)
                .sorted(Comparator.comparing(MacroscopChannelDto::getName)
                        .thenComparing(MacroscopChannelDto::getMacroscopId))
                .toList();
    }

    @Transactional
    @PreAuthorize("@securityAccessUtils.isAllowedAllActions()")
    public List<MacroscopChannelDto> updateChannelsForConfig(
            String configId, List<MacroscopChannelDto> dtoList) {
        _checkAllowedConfigByOrg(configId);
        var storedList = channelRepo.findByConfigId(configId);
        var creatorId = extractUserId(getCurrentAuth());
        var storedMap = storedList.stream()
                .collect(Collectors.toMap(MacroscopChannel::getMacroscopId, e -> e, (a, b) -> a));
        var dtoMap = dtoList.stream()
                .collect(Collectors.toMap(MacroscopChannelDto::getMacroscopId, d -> d, (a, b) -> a));
        var config = _getConfig(configId);

        var updates = storedList.stream()
                .map(stored -> {
                    var dto = dtoMap.get(stored.getMacroscopId());
                    if (dto == null) return null;
                    if (!dto.isExists()) {
                        if (!Boolean.TRUE.equals(stored.getExists())) return null;
                        stored.setExists(false);
                        stored.setUsed(false);
                        stored.setUpdatedBy(creatorId);
                        return stored;
                    }
                    fillChannelFromDto(stored, dto);
                    stored.setUsed(dto.isUsed());
                    stored.setExists(true);
                    stored.setUpdatedBy(creatorId);
                    return stored;
                }).filter(Objects::nonNull);
        var created = dtoList.stream().filter(d -> !storedMap.containsKey(d.getMacroscopId()))
                .filter(MacroscopChannelDto::isExists)
                .map(d -> {
                    var entity = new MacroscopChannel();
                    entity.setConfig(config);
                    entity.setMacroscopId(d.getMacroscopId());
                    fillChannelFromDto(entity, d);
                    entity.setUsed(d.isUsed());
                    entity.setExists(true);
                    entity.setCreatedBy(creatorId);
                    return entity;
                });
        var toSave = Stream.concat(updates, created).toList();
        if (!toSave.isEmpty()) {
            channelRepo.saveAll(toSave);
            channelRepo.flush();
        }
        return channelRepo.findByConfigId(configId).stream()
                .map(mapper::toDto)
                .sorted(Comparator.comparing(MacroscopChannelDto::getName)
                        .thenComparing(MacroscopChannelDto::getMacroscopId))
                .toList();
    }


    public List<MacroscopArchiveModeDto> getArchiveModes() {
        return Arrays.stream(MacroscopArchiveMode.values()).map(MacroscopArchiveModeDto::new)
                .sorted(Comparator.comparing(MacroscopArchiveModeDto::id)).collect(Collectors.toList());
    }


    @Transactional(readOnly = true)
    @PreAuthorize("@securityAccessUtils.isAllowedAllActions()")
    public MacroscopDataResponse<MacroscopServerInfoDto> getServerInfo(String configId) {
        _checkAllowedConfigByOrg(configId);
        var creds = _getCredsByConfigId(configId);
        return _getServerInfo(creds);
    }

    public MacroscopDataResponse<MacroscopServerInfoDto> getServerInfoByCreds(
            MacroscopServerCredentials creds) {
        var queryCreds = new MacroscopServerCredentials(creds.address(), creds.login(), Md5Hasher.md5HashUtf(creds.passwordHash()));
        return _getServerInfo(queryCreds);
    }

    @Transactional(readOnly = true)
    @PreAuthorize("@securityAccessUtils.isAllowedAllActions()")
    public MacroscopDataResponse<List<MacroscopChannelDto>> getAllowedChannels(String configId) {
        _checkAllowedConfigByOrg(configId);
        var creds = _getCredsByConfigId(configId);
        return _getAllowedChannels(creds);
    }

    @Transactional(readOnly = true)
    @PreAuthorize("@securityAccessUtils.isAllowedAllActions()")
    public MacroscopDataResponse<BinaryContent> getCurrentScreenShotOnChannel(
            String configId, String channelId
    ) {
        _checkAllowedConfigByOrg(configId);
        var creds = _getCredsByConfigId(configId);
        var channel = channelRepo.findByConfigIdAndMacroscopId(configId, channelId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Channel not found"));

        var mainRes = _getCurrentScreenShotOnChannel(creds, channel, MAIN_STREAM);
        var altRes = _getCurrentScreenShotOnChannel(creds, channel, ALT_STREAM);

        return _pickBestScreenshot(mainRes, altRes);
    }

    @Transactional(readOnly = true)
    @PreAuthorize("@securityAccessUtils.isAllowedAllActions()")
    public MacroscopDataResponse<BinaryContent> getLastArchiveScreenShotOnChannel(
            String configId, String channelId
    ) {
        _checkAllowedConfigByOrg(configId);
        var creds = _getCredsByConfigId(configId);
        var channel = channelRepo.findByConfigIdAndMacroscopId(configId, channelId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Channel not found"));

        return _getLastArchiveScreenShotOnChannel(creds, channel);
    }


    private MacroscopCredentials unmaskCreds(MacroscopCredentials src) {
        if (src == null) {
            return src;
        }
        src.setPassword(XorCipher.decrypt(src.getPassword(), xorSecret));
        return src;
    }

    private MacroscopCredentials maskCreds(MacroscopCredentials src) {
        if (src == null) {
            return src;
        }
        src.setPassword(XorCipher.encrypt(src.getPassword(), xorSecret));
        return src;
    }

    private MacroscopAgentConfigDto unmaskCreds(MacroscopAgentConfigDto dto) {
        if (dto != null) {
            dto.setCredentials(
                    mapper.toDto(unmaskCreds(mapper.fromDto(dto.getCredentials()))));
        }
        return dto;
    }

    private MacroscopEvtAgentConfig _getEvtConfig(String agentId) {
        var agent = evtService.getAgent(agentId);
        return evtConfigRepo.findById(agent.getId()).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Config for Macroscop event agent with id " + agentId + " not found"));
    }

    private MacroscopImgAgentConfig _getImgConfig(String agentId) {
        var agent = imgService.getAgent(agentId);
        return imgConfigRepo.findById(agent.getId()).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Config for Macroscop camera agent with id " + agentId + " not found"));
    }

    private MacroscopAgentConfig _getConfig(String configId) {
        return configRepo.findById(configId).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Macroscop config with id " + configId + " not found"));

    }

    private MacroscopAgentConfig _newConfig() {
        var ret = new MacroscopAgentConfig();
        ret.setCreatedBy(extractUserId(getCurrentAuth()));
        ret.setName("temp-" + UUID.randomUUID());
        return configRepo.saveAndFlush(ret);
    }

    private MacroscopAgentConfigDto _updateStoredConfig(MacroscopAgentConfigDto dto, MacroscopAgentConfig stored) {
        stored.setUpdatedBy(extractUserId(getCurrentAuth()));
        if (dto.getCredentials() != null) {
            stored.setCredentials(maskCreds(mapper.fromDto(dto.getCredentials())));
        }
        if (dto.getName() != null) {
            stored.setName(dto.getName());
        }
        stored.setServerAddress(dto.getServerAddress());
        if (dto.getServerInfo() != null) {
            if (stored.getServerInfo() == null) {
                stored.setServerInfo(new MacroscopServerInfo());
            }
            var dtoInfo = dto.getServerInfo();
            var entityInfo = stored.getServerInfo();
            entityInfo.setId(dtoInfo.getId());
            entityInfo.setVersion(dtoInfo.getVersion());
            entityInfo.setResponseDate(TimeUtils.zonedToOffset(dtoInfo.getResponseDate()));
            entityInfo.setTz(TimeUtils.zoneOffsetToString(dtoInfo.getTz()));
            entityInfo.setUseTz(dtoInfo.isUseTz());
        }
        stored = configRepo.saveAndFlush(stored);
        return unmaskCreds(mapper.toDto(stored));
    }

    private void _checkAllowedConfigByOrg(String configId) {
        if (sa.isSuperUser()) {
            return;
        }
        var allowed = sa.getAllowedOrganizations();
        if (allowed == null || allowed.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Config not allowed");
        }
        var allow = evtConfigRepo.findByConfigId(configId).stream()
                .map(EvtAgentConfig::getAgent).filter(Objects::nonNull)
                .map(EvtAgent::getOrganization).filter(Objects::nonNull)
                .map(Organization::getId).anyMatch(allowed::contains);
        if (!allow) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Config not allowed");
        }
    }

    private MacroscopServerCredentials _getCredsByConfigId(String configId) {
        var creds = mapper.toServerCredentials(unmaskCreds(mapper.toDto(
                configRepo.findById(configId).orElseThrow(() ->
                        new ResponseStatusException(HttpStatus.NOT_FOUND, "Config not found")))));
        if (creds == null || creds.address() == null || creds.address().isEmpty()
                || creds.login() == null || creds.login().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Invalid credentials in config");
        }
        return creds;
    }


    private MacroscopDataResponse<MacroscopServerInfoDto> _getServerInfo(MacroscopServerCredentials creds) {
        return macroscopService.getServerInfo(creds);
    }

    private MacroscopDataResponse<List<MacroscopChannelDto>> _getAllowedChannels(MacroscopServerCredentials creds) {
        return macroscopService.getAllowedChannels(creds);
    }

    private void fillChannelFromDto(MacroscopChannel channel, MacroscopChannelDto dto) {
        if (channel == null || dto == null) return;
        if (channel.getMacroscopId() != null && !Objects.equals(channel.getMacroscopId(), dto.getMacroscopId())) return;
        channel.setName(dto.getName());
        channel.setDevice(dto.getDevice());
        channel.setEnabled(dto.isEnabled());
        channel.setUsed(dto.isUsed());
        channel.setArchivingEnabled(dto.isArchivingEnabled());
        channel.setArchiveAllowed(dto.isArchiveAllowed());
        channel.setRealtimeAllowed(dto.isRealtimeAllowed());
        channel.setSoundAllowed(dto.isSoundAllowed());
        channel.setArchiveMode(MacroscopArchiveMode.byId(dto.getArchiveMode()));
        channel.setTz(TimeUtils.zoneOffsetToString(dto.getTz()));

        channel.getStreams().clear();
        if (dto.getStreams() != null) {
            dto.getStreams().stream()
                    .filter(Objects::nonNull)
                    .map(mapper::fromDto)
                    .forEach(channel.getStreams()::add);
        }
    }

    private MacroscopDataResponse<BinaryContent> _getCurrentScreenShotOnChannel(
            MacroscopServerCredentials creds,
            MacroscopChannel channel,
            String expectStream
    ) {
        assert channel != null;

        var channelId = channel.getMacroscopId();
        var streams = channel.getStreams();

        String streamType;
        if (streams == null || streams.isEmpty()) {
            streamType = expectStream;
        } else if (streams.stream()
                .anyMatch(s -> s != null && expectStream.equals(s.getType()))) {
            streamType = expectStream;
        } else {
            streamType = streams.stream()
                    .filter(s -> s != null && s.getType() != null)
                    .map(MacroscopChannelStream::getType)
                    .findFirst()
                    .orElse(expectStream);
        }

        return macroscopService.getCurrentScreenShotOnChannel(creds, channelId, streamType);
    }

    private MacroscopDataResponse<BinaryContent> _getLastArchiveScreenShotOnChannel(
            MacroscopServerCredentials creds,
            MacroscopChannel channel) {
        assert channel != null;

        var channelId = channel.getMacroscopId();
        return macroscopService.getLastArchiveScreenShotOnChannel(creds, channelId);
    }


    private MacroscopDataResponse<BinaryContent> _pickBestScreenshot(
            MacroscopDataResponse<BinaryContent> mainRes,
            MacroscopDataResponse<BinaryContent> altRes
    ) {
        boolean mainOk = _isValidContent(mainRes);
        boolean altOk = _isValidContent(altRes);
        if (!mainOk && !altOk) return mainRes;
        if (mainOk && !altOk) return mainRes;
        if (!mainOk) return altRes;

        int mainSize = mainRes.getData().getData().length;
        int altSize = altRes.getData().getData().length;
        return altSize > mainSize ? altRes : mainRes;
    }

    private static boolean _isValidContent(MacroscopDataResponse<BinaryContent> res) {
        return res != null
                && res.isSuccess()
                && res.getData() != null
                && res.getData().getData() != null
                && res.getData().getData().length > 0;
    }


}
