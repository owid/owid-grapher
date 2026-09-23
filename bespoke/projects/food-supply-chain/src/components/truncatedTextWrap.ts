import {
    shortenWithEllipsis,
    TextWrap,
} from "@ourworldindata/components/src/TextWrap/TextWrap.js"

/** A TextWrap cut to at most `maxLines` lines, with an ellipsis on the last one if anything was cut */
export function buildTruncatedTextWrap({
    text,
    maxWidth,
    maxLines,
    fontSize,
    fontWeight,
}: {
    text: string
    maxWidth: number
    maxLines: number
    fontSize: number
    fontWeight: number
}): TextWrap {
    const wrap = new TextWrap({ text, maxWidth, fontSize, fontWeight })
    if (wrap.lines.length <= maxLines) return wrap

    const kept = wrap.lines.slice(0, maxLines).map((line) => line.text)
    kept[kept.length - 1] = shortenWithEllipsis(
        kept[kept.length - 1],
        maxWidth,
        { fontSize, fontWeight }
    )
    return new TextWrap({
        text: kept.join("\n"),
        maxWidth,
        fontSize,
        fontWeight,
    })
}
