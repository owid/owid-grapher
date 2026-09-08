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
    FENCE + "(archie-document|archie)\\r?\\n([\\s\\S]+?)\\r?\\n" + FENCE,
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
