/*
 * Fenced examples of a sidecar, harvested per prose section so each one has
 * a stable identity: (section, position). The client renders one prose
 * section at a time and matches the n-th fence it meets to position n — it
 * never compares source text, so identical snippets stay distinct.
 */

import type {
    SidecarExample,
    SidecarExampleFlavour,
    SidecarProse,
    SidecarSectionKey,
} from "@ourworldindata/types"

const BT = String.fromCharCode(96)
const FENCE = BT + BT + BT

const SECTION_ORDER: SidecarSectionKey[] = [
    "intro",
    "whenToUse",
    "whenNotToUse",
    "notes",
]

const EXAMPLE_FENCE = new RegExp(
    FENCE + "(archie-document|archie)[ \t]*\\r?\\n([\\s\\S]+?)\\r?\\n" + FENCE,
    "g"
)

const ANY_FENCE = new RegExp(FENCE + "[^\\n]*\\r?\\n[\\s\\S]+?\\r?\\n" + FENCE)

export function harvestExamples(prose: SidecarProse): SidecarExample[] {
    const examples: SidecarExample[] = []
    for (const section of SECTION_ORDER) {
        const text = prose[section]
        if (!text) continue
        let position = 0
        for (const match of text.matchAll(EXAMPLE_FENCE)) {
            examples.push({
                archie: match[2],
                flavour: match[1] as SidecarExampleFlavour,
                section,
                position: position++,
            })
        }
    }
    return examples
}

/** Whether the text contains any fenced code block, of any language */
export function hasFence(text: string): boolean {
    return ANY_FENCE.test(text)
}

// Anchored to column 0, unlike EXAMPLE_FENCE/ANY_FENCE above: assumes
// sidecar fences always start at the beginning of a line. An indented
// fence would escape this language check while still rendering.
const FENCE_MARKER = new RegExp("^" + FENCE + "([^\\n]*)$", "gm")
const ALLOWED_FENCE_LANGUAGES = ["archie", "archie-document"]

/**
 * Fences must be balanced and speak one of the two example languages.
 *
 * Both are build errors rather than silent behaviour: an unterminated fence
 * would leak its content into the mention scan (which strips only closed
 * fences), and a fence in any other language is content the reference cannot
 * render or validate — it would simply disappear from the page.
 */
export function assertWellFormedFences(body: string, file: string): void {
    const infos = [...body.matchAll(FENCE_MARKER)].map((match) => match[1])
    if (infos.length % 2 !== 0)
        throw new Error(file + ": has an unterminated code fence")
    // Fence markers alternate open/close; only the opening ones carry a
    // language.
    for (let i = 0; i < infos.length; i += 2) {
        // The `$` of a multiline match sits before the \n, so a CRLF file
        // leaves the \r on the info line.
        const info = infos[i].replace(/[ \t\r]+$/, "")
        if (!ALLOWED_FENCE_LANGUAGES.includes(info))
            throw new Error(
                file +
                    ': code fence with unsupported language "' +
                    info +
                    '" — use archie or archie-document'
            )
    }
}
