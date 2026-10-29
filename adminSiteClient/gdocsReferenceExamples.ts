import {
    RelatedRef,
    SidecarExample,
    SidecarSectionKey,
} from "@ourworldindata/types"

/**
 * The registry index of the example behind the `ordinal`-th fence rendered
 * in `section` — fences are identified by place, never by source text, so
 * two identical snippets resolve to two different examples.
 */
export function exampleIndexForFence(
    examples: SidecarExample[],
    section: SidecarSectionKey,
    ordinal: number
): number | undefined {
    const index = examples.findIndex(
        (example) => example.section === section && example.position === ordinal
    )
    return index >= 0 ? index : undefined
}

const KIND_SEGMENT: Record<RelatedRef["kind"], string> = {
    component: "components",
    guide: "guides",
    template: "templates",
}

/** Admin route of a component, guide or template reference page */
export function referencePathFor(ref: RelatedRef): string {
    return `/gdocs-reference/${KIND_SEGMENT[ref.kind]}/${ref.id}`
}

const MENTION = /^\{(\.|guide:|template:)([a-z0-9-]+)\}$/
const KIND_BY_PREFIX: Record<string, RelatedRef["kind"]> = {
    ".": "component",
    "guide:": "guide",
    "template:": "template",
}

/** The ref an inline code span mentions, if its whole content is a mention */
export function parseMention(code: string): RelatedRef | undefined {
    const match = MENTION.exec(code)
    return match ? { kind: KIND_BY_PREFIX[match[1]], id: match[2] } : undefined
}
