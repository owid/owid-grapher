/**
 * A sidecar body split around its decision prose: the intro (everything
 * before the first "## " heading), the "## When to use" / "## When NOT to
 * use" sections (headings stripped — the page renders them as a decision
 * box), and the rest of the body with its own headings intact.
 */
export interface SidecarBodyParts {
    intro: string
    whenToUse?: string
    whenNotToUse?: string
    rest: string
}

export function splitSidecarBody(body: string): SidecarBodyParts {
    const chunks = body.split(/^(?=## )/m)
    const parts: SidecarBodyParts = { intro: "", rest: "" }
    const restChunks: string[] = []
    for (const [index, chunk] of chunks.entries()) {
        const headingMatch = /^## +(.+)\r?\n?/.exec(chunk)
        if (!headingMatch) {
            if (index === 0) parts.intro = chunk.trim()
            else restChunks.push(chunk)
            continue
        }
        const heading = headingMatch[1].trim().toLowerCase()
        let content = chunk.slice(headingMatch[0].length)
        if (heading === "when to use" || heading === "when not to use") {
            // "### …" subsections following the decision prose (e.g. the
            // "### Example" of a template sidecar) belong to the rest of the
            // body, not to the decision box.
            const subsection = /^### /m.exec(content)
            if (subsection) {
                restChunks.push(content.slice(subsection.index))
                content = content.slice(0, subsection.index)
            }
            if (heading === "when to use") parts.whenToUse = content.trim()
            else parts.whenNotToUse = content.trim()
        } else {
            restChunks.push(chunk)
        }
    }
    parts.rest = restChunks.join("").trim()
    return parts
}

/**
 * Drop the fenced archie examples (and the "### …" heading naming each one)
 * from a sidecar markdown fragment. The component page presents examples
 * through the forms section — curated names on observed forms, dashed "new"
 * cards for unobserved ones — so the notes area renders only the surrounding
 * prose.
 */
export function stripExampleBlocks(markdown: string): string {
    return markdown
        .replace(/(^### [^\n]*\n+)?^```archie\r?\n[\s\S]*?^```[ \t]*$/gm, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
}

/**
 * The sidecar prose destined for the authored-notes area under the derived
 * properties table: examples stripped (the forms section presents them), and
 * the conventional "## Notes" / "## Variations" section headings dropped —
 * the notes area carries its own title.
 */
export function sidecarNotesMarkdown(rest: string): string {
    return stripExampleBlocks(rest)
        .replace(/^## +(Notes|Variations)[ \t]*$/gim, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
}
