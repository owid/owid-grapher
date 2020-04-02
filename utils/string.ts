const URL_REGEX = /[-a-zA-Z0-9@:%_\+.~#?&//=]{2,256}\.[a-z]{2,4}\b(\/[-a-zA-Z0-9@:%_\+.~#?&//=]*)?/gi

export function findUrlsInText(s: string): string[] {
    return s.match(URL_REGEX) || []
}

export function parseBool(input: string): boolean {
    const normalized = input.trim().toLowerCase()
    return normalized === "true" || normalized === "1"
}
