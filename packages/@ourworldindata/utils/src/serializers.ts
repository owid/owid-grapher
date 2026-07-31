const jsonCommentDelimiter = "\n//EMBEDDED_JSON\n"

export const escapeJSONStringForInlineScript = (json: string): string =>
    json
        .replace(/</g, "\\u003c")
        .replace(/\u2028/g, "\\u2028")
        .replace(/\u2029/g, "\\u2029")

// Stringifies JSON for assigning to a variable inside an inline <script>. Escaping is not
// optional here: an unescaped `</script>` anywhere in the data closes the tag early and
// everything after it is parsed as HTML, which turns any free-text field into stored XSS.
//
// Prefer this over serializeJSONForHTML for inline scripts. That one pretty-prints and wraps
// the payload in //EMBEDDED_JSON delimiters so it can be recovered from raw HTML later — only
// the explorer needs that, and on a large payload the indentation is pure page weight.
export const serializeJSONForInlineScript = (obj: unknown): string =>
    escapeJSONStringForInlineScript(JSON.stringify(obj))

// Stringifies JSON for placing into an arbitrary doc, for later extraction without parsing the whole doc
export const serializeJSONForHTML = (
    obj: unknown,
    delimiter = jsonCommentDelimiter
): string =>
    `${delimiter}${
        obj === undefined
            ? ""
            : escapeJSONStringForInlineScript(JSON.stringify(obj, null, 2))
    }${delimiter}`
export const deserializeJSONFromHTML = (
    html: string,
    delimiter = jsonCommentDelimiter
): any => {
    const json = html.split(delimiter)[1]
    return json === undefined || json === "" ? undefined : JSON.parse(json)
}
