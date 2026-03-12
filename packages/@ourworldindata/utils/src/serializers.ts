const jsonCommentDelimiter = "\n//EMBEDDED_JSON\n"

const escapeJSONStringForInlineScript = (json: string): string =>
    json
        .replace(/</g, "\\u003c")
        .replace(/\u2028/g, "\\u2028")
        .replace(/\u2029/g, "\\u2029")

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
