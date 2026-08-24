export interface TableDataChanges {
    added: string[];
    modified: string[];
    deleted: string[];
    deletedItems: any[];
}



export interface SaveDataError {
    id: string | number,
    message: string
}