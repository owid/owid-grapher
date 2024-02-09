export enum RedirectCode {
    MOVED_PERMANENTLY = 301,
    FOUND = 302,
}

export interface Redirect {
    source: string
    target: string
    code: RedirectCode
}
