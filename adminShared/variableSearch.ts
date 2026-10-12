/**
 * Split on whitespace except inside double quotes, which keep a phrase
 * together and are dropped. A lone unbalanced quote runs to the end.
 */
export function splitSearchTerms(query: string): string[] {
    const terms: string[] = []
    let current = ""
    let inQuotes = false
    for (const char of query) {
        if (char === '"') inQuotes = !inQuotes
        else if (/\s/.test(char) && !inQuotes) {
            if (current) terms.push(current)
            current = ""
        } else current += char
    }
    if (current) terms.push(current)
    return terms
}
