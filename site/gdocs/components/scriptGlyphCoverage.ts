import { createContext } from "react"

// Superscripts and subscripts are styled with the "sups"/"subs" OpenType
// features (see the superscript/subscript mixins in typography.scss), which
// only swap in raised/lowered glyphs for the characters the font provides them
// for. Anything else, e.g. "." in "1.585", would stay full size on the
// baseline. These are the characters the site's body font (Lato) covers, read
// from the GSUB tables of the self-hosted font files in public/fonts/.
export const LATO_SUPS_CHARACTERS = new Set(
    "()+0123456789=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz−"
)
export const LATO_SUBS_CHARACTERS = new Set(
    "#$()+,.0123456789=n¢£¤¥€−"
)

export type ScriptPosition = "superscript" | "subscript"

export const SCRIPT_POSITION_CHARACTERS: Record<
    ScriptPosition,
    ReadonlySet<string>
> = {
    superscript: LATO_SUPS_CHARACTERS,
    subscript: LATO_SUBS_CHARACTERS,
}

// Set by <sup>/<sub> spans so that the text nested inside them (possibly
// several levels deep, e.g. in a bold or link span) knows its position
export const ScriptPositionContext = createContext<ScriptPosition | undefined>(
    undefined
)

export interface GlyphCoverageRun {
    text: string
    isCovered: boolean
}

/**
 * Splits text into consecutive runs of characters that are/aren't in the
 * covered set. Whitespace counts as covered, since it has no glyph to
 * reposition.
 */
export function splitByGlyphCoverage(
    text: string,
    coveredCharacters: ReadonlySet<string>
): GlyphCoverageRun[] {
    const runs: GlyphCoverageRun[] = []
    for (const char of text) {
        const isCovered = coveredCharacters.has(char) || /\s/.test(char)
        const lastRun = runs.at(-1)
        if (lastRun && lastRun.isCovered === isCovered) lastRun.text += char
        else runs.push({ text: char, isCovered })
    }
    return runs
}
