import { Span } from "@ourworldindata/types"
import { spansToUnformattedPlainText } from "@ourworldindata/utils"

// Superscripts and subscripts are styled with font-variant-position (see the
// superscript/subscript mixins in typography.scss), which only swaps in
// raised/lowered glyphs for the characters the font provides them for.
// Anything else, e.g. "." in "1.585", would stay full size on the baseline
// (in Firefox, the whole run would be synthesized instead). These are the
// characters the site's body font (Lato) covers, read from the GSUB tables of
// the self-hosted font files in public/fonts/.
export const LATO_SUPS_CHARACTERS = new Set(
    "()+0123456789=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz−"
)
export const LATO_SUBS_CHARACTERS = new Set("#$()+,.0123456789=n¢£¤¥€−")

export type ScriptPosition = "superscript" | "subscript"

const SCRIPT_POSITION_CHARACTERS: Record<
    ScriptPosition,
    ReadonlySet<string>
> = {
    superscript: LATO_SUPS_CHARACTERS,
    subscript: LATO_SUBS_CHARACTERS,
}

/**
 * Whether the font has a superscript/subscript glyph for every character of
 * the text. Whitespace counts as covered, since it has no glyph to replace.
 */
export function hasScriptGlyphCoverage(
    text: string,
    scriptPosition: ScriptPosition
): boolean {
    const characters = new Set(text.replace(/\s/g, ""))
    return characters.isSubsetOf(SCRIPT_POSITION_CHARACTERS[scriptPosition])
}

/**
 * The class that makes CSS draw a whole superscript/subscript without the
 * font's glyphs, when the font lacks a glyph for any of its characters.
 * Mixing real glyphs with scaled-down regular ones would look uneven.
 */
export function getScriptFallbackClassName(
    spans: Span[],
    scriptPosition: ScriptPosition
): string | undefined {
    const text = spansToUnformattedPlainText(spans)
    return hasScriptGlyphCoverage(text, scriptPosition)
        ? undefined
        : `span-${scriptPosition}-fallback`
}
