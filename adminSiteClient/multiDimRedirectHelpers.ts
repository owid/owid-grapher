// Formats source query params for display (a `null` value denotes a wildcard).
export function formatSourceQueryParams(
    params: Record<string, string | null> | null
): string | null {
    if (!params || Object.keys(params).length === 0) return null
    return Object.entries(params)
        .map(([key, value]) =>
            value === null ? `${key}=*` : `${key}=${value}`
        )
        .join("&")
}
