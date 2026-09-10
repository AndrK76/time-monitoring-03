export interface ErrorResponseResult {
    status?: number,
    message?: string
}

export function processResponseError(err: any): ErrorResponseResult {
    if (!err) {
        console.log('Empty err data');
        return {} as ErrorResponseResult;
    }

    return {
        status: !!err.status ? err.status : undefined,
        message: err.error?.detail ?? err.statusText
    } as ErrorResponseResult;;
}