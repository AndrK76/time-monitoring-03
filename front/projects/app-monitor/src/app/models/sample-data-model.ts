export interface Place {
    id: string;
    name: string;
}

export interface EventStatus {
    code: string;
    warning: string;
    name: string;
    display: string;
    color?: string;
}

export interface EventData {
    id: string;
    start: string;
    end: string;
    status: string;
    booking_id?: string;
}


export interface PlaceEvents {
    place: string;
    events: EventData[];
}

export interface PlaceEventGroup {
    start: string;
    end: string;
    bars: PlaceEvents[];
}


export interface ContentItem {
    group: PlaceEventGroup;
}

export interface SampleData {
    places: Place[];
    statuses: EventStatus[];
    content: ContentItem[];
}