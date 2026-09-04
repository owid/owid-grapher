/*
 * The section vocabulary of a reference sidecar, declared once.
 *
 * A sidecar is prose with structure: an intro, decision prose ("## When to
 * use" / "## When NOT to use"), a "## Properties" section the generator turns
 * into the properties table, and free-form sections. Nothing about that
 * structure is inferable from the file, so it is declared here, and every
 * sidecar is parsed against it at generation time — once. The registries then
 * carry the split prose (SidecarProse), so no consumer re-parses the markdown
 * and no consumer can disagree with the generator about what a heading means.
 *
 * Every way of getting it wrong is a build error, including the near misses:
 * "## When to use it" or "## Propertes" fail with the heading they meant,
 * rather than silently drifting into the free prose the way an unrecognized
 * heading used to.
 */

import type { SidecarProse } from "@ourworldindata/types"

/** The kind of sidecar being parsed — templates have no properties table */
export type SidecarKind = "component" | "template"

interface SidecarSectionSpec {
    /** Where the section's content ends up */
    key: "whenToUse" | "whenNotToUse" | "notes" | "properties"
    /** The "## " heading authors write, matched case-insensitively */
    heading: string
    /** Sidecar kinds that may carry the section */
    kinds: SidecarKind[]
}

/**
 * The complete list of headings that mean something structurally. Any other
 * "## " heading is free prose, rendered with the notes — unless it looks like
 * a misspelling of one of these, which is an error.
 */
export const SIDECAR_SECTIONS: readonly SidecarSectionSpec[] = [
    {
        key: "whenToUse",
        heading: "When to use",
        kinds: ["component", "template"],
    },
    {
        key: "whenNotToUse",
        heading: "When NOT to use",
        kinds: ["component", "template"],
    },
    { key: "properties", heading: "Properties", kinds: ["component"] },
    { key: "notes", heading: "Notes", kinds: ["component", "template"] },
]

export interface ParsedSidecarProse {
    /** The split prose, as the registries carry it */
    prose: SidecarProse
    /**
     * Raw body of the "## Properties" section (components only) — bullets the
     * generator joins onto the props derived from the type.
     */
    properties?: string
}

function normalizeHeading(heading: string): string {
    return heading.toLowerCase().replace(/[^a-z0-9]/g, "")
}

function editDistance(a: string, b: string): number {
    let previous = Array.from({ length: b.length + 1 }, (_, i) => i)
    for (let i = 1; i <= a.length; i++) {
        const current = [i]
        for (let j = 1; j <= b.length; j++) {
            current[j] = Math.min(
                previous[j] + 1,
                current[j - 1] + 1,
                previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
            )
        }
        previous = current
    }
    return previous[b.length]
}

/**
 * The structural heading an unrecognized one was probably meant to be: an
 * extra word ("When to use it"), a typo ("Propertes"), a stray suffix
 * ("Properties:"). Free sections an author genuinely wants ("Limitations",
 * "Variations") are nowhere near one of the four, so they pass through.
 */
function nearestSection(
    heading: string,
    kind: SidecarKind
): SidecarSectionSpec | undefined {
    const candidate = normalizeHeading(heading)
    for (const section of SIDECAR_SECTIONS) {
        const canonical = normalizeHeading(section.heading)
        if (candidate.startsWith(canonical) || canonical.startsWith(candidate))
            return section
        // Short headings tolerate less: "Types" must not read as "Notes".
        const threshold = Math.min(
            3,
            Math.max(1, Math.floor(canonical.length / 4))
        )
        if (editDistance(candidate, canonical) <= threshold) return section
    }
    // A "## Properties" section in a template sidecar is a near miss of a
    // different kind: the right heading, the wrong file.
    return SIDECAR_SECTIONS.find(
        (section) =>
            !section.kinds.includes(kind) &&
            normalizeHeading(section.heading) === candidate
    )
}

function allowedHeadings(kind: SidecarKind): string {
    return SIDECAR_SECTIONS.filter((section) => section.kinds.includes(kind))
        .map((section) => '"## ' + section.heading + '"')
        .join(", ")
}

/**
 * Splits a sidecar body into its declared sections, failing on anything
 * ambiguous. The caller decides which sections are *required* — that depends
 * on the sidecar's front matter, which this doesn't see.
 */
export function splitSidecarProse(
    body: string,
    file: string,
    kind: SidecarKind
): ParsedSidecarProse {
    const chunks = body.split(/^(?=## )/m)
    const contents = new Map<SidecarSectionSpec["key"], string>()
    const freeChunks: string[] = []
    let intro = ""

    for (const [index, chunk] of chunks.entries()) {
        const headingMatch = /^## +(.+?)[ \t]*(?:\r?\n|$)/.exec(chunk)
        if (!headingMatch) {
            // Only the first chunk can lack a heading: it is the intro.
            if (index === 0) intro = chunk.trim()
            else freeChunks.push(chunk)
            continue
        }
        const heading = headingMatch[1]
        const content = chunk.slice(headingMatch[0].length).trim()
        const section = SIDECAR_SECTIONS.find(
            (candidate) =>
                normalizeHeading(candidate.heading) ===
                    normalizeHeading(heading) && candidate.kinds.includes(kind)
        )
        if (!section) {
            const nearest = nearestSection(heading, kind)
            if (nearest)
                throw new Error(
                    file +
                        ': section "## ' +
                        heading +
                        '" is not one of the ' +
                        'reference sections — did you mean "## ' +
                        nearest.heading +
                        '"?' +
                        (nearest.kinds.includes(kind)
                            ? ""
                            : " (that section belongs in a " +
                              nearest.kinds.join("/") +
                              " sidecar, not a " +
                              kind +
                              " one)")
                )
            freeChunks.push(chunk)
            continue
        }
        if (contents.has(section.key))
            throw new Error(
                file +
                    ': has more than one "## ' +
                    section.heading +
                    '" section'
            )
        if (!content)
            throw new Error(
                file + ': "## ' + section.heading + '" section is empty'
            )
        // A subsection under a structural section reads as part of it but
        // renders elsewhere; make the author move it out rather than
        // relocating their prose behind their back.
        const subsection = /^### +(.+)$/m.exec(content)
        if (subsection)
            throw new Error(
                file +
                    ': "## ' +
                    section.heading +
                    '" contains the subsection "### ' +
                    subsection[1].trim() +
                    '" — the section renders as a single block, so promote ' +
                    'the subsection to its own "## " section'
            )
        contents.set(section.key, content)
    }

    if (!intro)
        throw new Error(
            file +
                ': has no intro — the prose before the first "## " heading ' +
                "is what the reference leads with. Allowed sections after it: " +
                allowedHeadings(kind)
        )

    // Authored notes and free-form sections render as one run of prose under
    // the derived material. "## Notes" loses its heading (the area carries
    // its own title); free sections keep theirs.
    const notes = [contents.get("notes"), freeChunks.join("").trim()]
        .filter(Boolean)
        .join("\n\n")
        .trim()

    const prose: SidecarProse = { intro }
    const whenToUse = contents.get("whenToUse")
    if (whenToUse) prose.whenToUse = whenToUse
    const whenNotToUse = contents.get("whenNotToUse")
    if (whenNotToUse) prose.whenNotToUse = whenNotToUse
    if (notes) prose.notes = notes

    const properties = contents.get("properties")
    return { prose, ...(properties && { properties }) }
}
