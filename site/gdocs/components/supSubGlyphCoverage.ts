import { Span } from "@ourworldindata/types"
import { spansToUnformattedPlainText } from "@ourworldindata/utils"

// The sup/sub mixins in typography.scss use font-variant-position, which only
// raises or lowers characters the font has a glyph for. Other characters stay
// full size on the baseline. These sets come from the GSUB tables of Lato in
// public/fonts/.
const LATO_SUPS_CHARACTERS = new Set(
    "()+0123456789=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz−"
)
const LATO_SUBS_CHARACTERS = new Set("#$()+,.0123456789=n¢£¤¥€−")

type Position = "superscript" | "subscript"

const LATO_SUP_SUB_CHARACTERS: Record<Position, ReadonlySet<string>> = {
    superscript: LATO_SUPS_CHARACTERS,
    subscript: LATO_SUBS_CHARACTERS,
}

/**
 * Whether the font has a superscript/subscript glyph for every character of
 * the text. Whitespace counts as covered, since it has no glyph to replace.
 */
function hasSupSubGlyphCoverage(text: string, position: Position): boolean {
    const characters = new Set(text.replace(/\s/g, ""))
    return characters.isSubsetOf(LATO_SUP_SUB_CHARACTERS[position])
}

/**
 * The class that makes CSS draw a whole superscript/subscript without the
 * font's glyphs, when the font lacks a glyph for any of its characters.
 * Mixing real glyphs with scaled-down regular ones would look uneven.
 *
 * We don't use the fallback for every superscript/subscript because Lato's
 * glyphs cover most of them (e.g. digits in exponents or chemical formulas),
 * and the font's own glyphs look better than scaled-down regular ones.
 */
export function getSupSubFallbackClassName(
    spans: Span[],
    position: Position
): string | undefined {
    const text = spansToUnformattedPlainText(spans)
    return hasSupSubGlyphCoverage(text, position)
        ? undefined
        : `span-${position}-fallback`
}
