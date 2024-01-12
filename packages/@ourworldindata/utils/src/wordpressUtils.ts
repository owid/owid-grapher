import { FormattingOptions, KeyValueProps } from "@ourworldindata/types"

export const extractFormattingOptions = (html: string): FormattingOptions => {
    const formattingOptionsMatch = html.match(
        /<!--\s*formatting-options(.*)-->/
    )
    const innerFormattingOptions = formattingOptionsMatch
        ? formattingOptionsMatch[1].trim()
        : ""
    return formattingOptionsMatch
        ? parseFormattingOptions(innerFormattingOptions)
        : {}
}

// Converts "toc:false raw somekey:somevalue" to { toc: false, raw: true, somekey: "somevalue" }
// If only the key is specified, the value is assumed to be true (e.g. "raw" above)
export const parseFormattingOptions = (text: string): FormattingOptions => {
    return parseKeyValueArgs(text)
}

export const parseKeyValueArgs = (text: string): KeyValueProps => {
    const options: { [key: string]: string | boolean } = {}
    text.split(/\s+/)
        // filter out empty strings
        .filter((s) => s && s.length > 0)
        .forEach((option: string) => {
            // using regex instead of split(":") to handle ":" in value
            // e.g. {{LastUpdated timestampUrl:https://...}}
            const optionRegex = /([^:]+):?(.*)/
            const [, name, value] = option.match(optionRegex) as [
                any,
                string,
                string,
            ]
            let parsedValue
            if (value === "" || value === "true") parsedValue = true
            else if (value === "false") parsedValue = false
            else parsedValue = value
            options[name] = parsedValue
        })
    return options
}
