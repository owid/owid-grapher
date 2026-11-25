export interface RichTextSpan {
    text: string
    bold: boolean
}

/** Splits text with `**bold**` markers into spans */
export function parseRichText(text: string): RichTextSpan[] {
    return text
        .split(/(\*\*[^*]+\*\*)/)
        .filter(Boolean)
        .map((part) =>
            part.startsWith("**") && part.endsWith("**")
                ? { text: part.slice(2, -2), bold: true }
                : { text: part, bold: false }
        )
}
