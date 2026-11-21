/** A run of text with the same emphasis */
export interface RichTextSegment {
    text: string
    bold?: boolean
    italic?: boolean
    /** A country or region the text names, shown in its series colour */
    entity?: string
}

/**
 * Splits a walkthrough sentence into runs: `**bold**`, `*italic*` and
 * `[[Entity]]`, which may nest inside the other two ("**[[Sweden]]**").
 * An unclosed marker carries its emphasis to the end of the text.
 */
export function parseRichText(source: string): RichTextSegment[] {
    const segments: RichTextSegment[] = []
    let bold = false
    let italic = false
    let entity: string | undefined
    let buffer = ""

    const flush = (): void => {
        if (buffer === "") return
        const segment: RichTextSegment = { text: buffer }
        if (bold) segment.bold = true
        if (italic) segment.italic = true
        if (entity !== undefined) segment.entity = entity
        // Merge with the previous run when nothing changed
        const previous = segments.at(-1)
        if (
            previous &&
            previous.bold === segment.bold &&
            previous.italic === segment.italic &&
            previous.entity === segment.entity
        )
            previous.text += segment.text
        else segments.push(segment)
        buffer = ""
    }

    let i = 0
    while (i < source.length) {
        if (source.startsWith("**", i)) {
            flush()
            bold = !bold
            i += 2
        } else if (source[i] === "*") {
            flush()
            italic = !italic
            i += 1
        } else if (entity === undefined && source.startsWith("[[", i)) {
            const close = source.indexOf("]]", i + 2)
            if (close === -1) {
                buffer += source[i]
                i += 1
                continue
            }
            flush()
            entity = source.slice(i + 2, close)
            buffer = entity
            flush()
            entity = undefined
            i = close + 2
        } else {
            buffer += source[i]
            i += 1
        }
    }
    flush()
    return segments
}

/** The plain text of a sentence, without its markers */
export function richTextToPlain(source: string): string {
    return parseRichText(source)
        .map((segment) => segment.text)
        .join("")
}
