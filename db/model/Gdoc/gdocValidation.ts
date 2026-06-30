export function documentContainsMixedStraightAndCurlyQuotes(
    serializedContent: string
): boolean {
    return /'|\\"/.test(serializedContent) && /[‘’“”]/.test(serializedContent)
}
