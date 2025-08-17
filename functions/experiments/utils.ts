/*
 * Checks whether all strings in an array are unique.
 *
 * Iterates through the provided array and returns `false` if any duplicate strings are found.
 * Returns `true` if all values are distinct.
 *
 * @param values - An array of strings to check for uniqueness.
 * @returns `true` if all strings are unique, `false` otherwise.
 *
 * @example
 * validateUniqueStrings(["a", "b", "c"]) // true
 * validateUniqueStrings(["a", "b", "a"]) // false
 */
export function validateUniqueStrings(values: string[]): boolean {
    const seen = new Set<string>()
    for (const value of values) {
        if (seen.has(value)) return false
        seen.add(value)
    }
    return true
}

/**
 * Checks if a request is made from within an iframe.
 *
 * Note that this function relies on the `sec-fetch-dest` header, which is not
 * always present and is not supported by older browsers. It is possible for a
 * request to be made from an iframe without this header being set.
 *
 * @param request - The request object to check.
 * @returns `true` if the request is made from an iframe, `false` otherwise.
 */
export function requestIsInIframe(request: Request): boolean {
    const secFetchDest = request.headers.get("sec-fetch-dest")

    if (secFetchDest === "iframe") {
        return true
    }

    return false
}

/**
 * Checks if a given URL points to a static asset file.
 *
 * This function parses the provided URL and checks if its pathname ends with a common static asset file extension,
 * such as JavaScript, CSS, image, font, JSON, icon, or source map files.
 *
 * @param url - The URL string to check.
 * @returns `true` if the URL points to a static asset, `false` otherwise.
 *
 * @example
 * isStaticAsset("https://example.com/styles/main.css") // true
 * isStaticAsset("https://example.com/data") // false
 */
export function isStaticAsset(url: string): boolean {
    const pathname = new URL(url).pathname
    if (
        /\.(js|css|svg|png|jpg|jpeg|gif|woff2?|ttf|eot|otf|json|ico|map)$/.test(
            pathname
        )
    ) {
        return true
    }
    return false
}
