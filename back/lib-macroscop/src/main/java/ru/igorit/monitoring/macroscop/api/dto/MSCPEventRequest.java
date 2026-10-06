package ru.igorit.monitoring.macroscop.api.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class MSCPEventRequest {
    @JsonProperty("startTimeUtc")
    private String startTimeUtc;
    @JsonProperty("endTimeUtc")
    private String endTimeUtc;
    @JsonProperty("isSearchFromBegin")
    private boolean searchFromBegin;
    @JsonProperty("searchLimitCount")
    private int searchLimit;
    @JsonProperty("eventIds")
    private List<String> eventIds;
    @JsonProperty("ChannelIds")
    private List<String> channelIds;

}
