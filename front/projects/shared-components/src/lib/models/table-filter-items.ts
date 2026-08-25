export interface TableFilterInfo {
    key: string;
    type: TableFilterType;
    config?: TableFilterListConfig;
    value?: TableFilterListValue | TableFilterDateValue | TableFilterTextValue
}

export enum TableFilterType {
    LIST,
    DATE,
    TEXT
}

export interface TableFilterListConfig {
    dataSource?: TableFilterListValue[];
}

export interface TableFilterListValue {
    id?: any;
    text?: string;
}

export interface TableFilterDateValue {
    greatest?: boolean;
    date?: string;
}

export interface TableFilterTextValue {
    flag?: string;
    text?: string;
}

