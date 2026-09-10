import { YClientsAgentConfigDto } from "@mon3/sc"
import { YClientsAgentConfigView } from "./yclients-view.models"

export const yClientsAgentConfigDtoToView = (dto: YClientsAgentConfigDto): YClientsAgentConfigView => {
    return {
        id: dto.id,
        credentials: {
            apiUrl: dto.credentials.apiUrl,
            partnerToken: dto.credentials.partnerToken,
            userToken: dto.credentials.userToken,
        },
    } as YClientsAgentConfigView
}

export const yClientsAgentConfigDtoFromView = (item: YClientsAgentConfigView): YClientsAgentConfigDto => {
    return {
        id: item.id,
        credentials: {
            apiUrl: item.credentials.apiUrl,
            partnerToken: item.credentials.partnerToken,
            userToken: item.credentials.userToken,
        },
    } as YClientsAgentConfigDto
}
