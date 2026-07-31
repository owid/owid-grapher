/** Outcome of attempting to create a single redirect in a bulk request. */
export interface BulkMultiDimRedirectResult {
    source: string
    status: "created" | "skipped" | "error"
    message?: string
    redirectId?: number
}

/** Response body of the `/api/multi-dim-redirects/bulk` endpoint. */
export interface BulkMultiDimRedirectResponse {
    success: boolean
    created: number
    skipped: number
    errors: number
    results: BulkMultiDimRedirectResult[]
}
