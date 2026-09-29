/*
 * The "- `name`: description" bullets that sidecars use to describe fields.
 *
 * Both references author descriptions this way: a component sidecar's
 * "## Properties" section describes the props derived from its type alias, and
 * templates/<InterfaceName>.md describes the fields of a content interface.
 * The generator joins these onto the derived fields and fails the build on any
 * drift, so this parser decides what counts as a description — which is why it
 * lives here, testable, rather than inside the generator script.
 *
 * A description may continue on following indented lines; anything else ends
 * it. Duplicate and empty descriptions are build errors.
 */

const ENTRY = /^-\s+`([^`]+)`:\s*(.*)$/
const CONTINUATION = /^\s+\S/

/**
 * @param text the raw section/file body
 * @param file repo-relative path, used only in error messages
 */
export function parseFieldDescriptions(
    text: string,
    file: string
): Map<string, string> {
    const descriptions = new Map<string, string>()
    let current: string | undefined
    for (const line of text.split(/\r?\n/)) {
        const entry = ENTRY.exec(line)
        if (entry) {
            current = entry[1]
            if (descriptions.has(current))
                throw new Error(
                    'Duplicate field description for "' +
                        current +
                        '" in ' +
                        file
                )
            if (!entry[2].trim())
                throw new Error(
                    file +
                        ": `" +
                        current +
                        "` has no description — every field bullet needs " +
                        "one, since the reference renders it"
                )
            descriptions.set(current, entry[2].trim())
        } else if (current && CONTINUATION.test(line)) {
            descriptions.set(
                current,
                descriptions.get(current) + " " + line.trim()
            )
        } else {
            current = undefined
        }
    }
    return descriptions
}
