/** Comma-separated names, blank entries dropped; an all-blank list leaves the key unset */
export function parseCountryList(value: string): string[] | undefined {
    const names = value
        .split(",")
        .map((name) => name.trim())
        .filter((name) => name.length > 0)
    return names.length > 0 ? names : undefined
}

export function parsePositiveNumber(value: string): number {
    const n = Number(value)
    if (!Number.isFinite(n) || n <= 0)
        throw new Error(`Not a positive number: "${value}"`)
    return n
}
