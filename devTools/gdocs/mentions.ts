/*
 * Cross-reference mentions in sidecar prose.
 *
 * A mention is an inline code span whose entire content is `{.component-id}`,
 * `{guide:guide-id}` or `{template:template-id}` — the same rule the admin
 * client applies when it links them, so the two can never disagree. Fenced
 * blocks are stripped before matching, so example code is never scanned.
 * Resolution fails the build on an unknown id, which is what lets the client
 * link every harvested mention unconditionally. `findBareKnownIds` is a
 * separate lint: a bare known id in a single-backtick span (not written as
 * a mention) also fails the build, naming the explicit form to use instead —
 * there is only one linking syntax, and no bare-id path the client renders.
 */

import type { RelatedRef, RelatedRefKind } from "@ourworldindata/types"

const BT = String.fromCharCode(96)
const FENCE = BT + BT + BT
const FENCED_BLOCK = new RegExp(FENCE + "[\\s\\S]*?" + FENCE, "g")
const MENTION = new RegExp(
    BT + "\\{(\\.|guide:|template:)([a-z0-9-]+)\\}" + BT,
    "g"
)

const KIND_BY_PREFIX: Record<string, RelatedRefKind> = {
    ".": "component",
    "guide:": "guide",
    "template:": "template",
}

const BARE_SPAN = new RegExp(
    "(?<!" + BT + ")" + BT + "([a-z0-9-]+)" + BT + "(?!" + BT + ")",
    "g"
)

// Lookup order when a bare id is known as more than one kind.
const BARE_LOOKUP_KINDS: RelatedRefKind[] = ["component", "template", "guide"]

const PREFIX_BY_KIND: Record<RelatedRefKind, string> = {
    component: ".",
    guide: "guide:",
    template: "template:",
}

export interface KnownIds {
    component: Set<string>
    guide: Set<string>
    template: Set<string>
}

export function harvestMentions(texts: (string | undefined)[]): RelatedRef[] {
    const seen = new Set<string>()
    const mentions: RelatedRef[] = []
    for (const text of texts) {
        if (!text) continue
        const prose = text.replace(FENCED_BLOCK, "")
        for (const match of prose.matchAll(MENTION)) {
            const kind = KIND_BY_PREFIX[match[1]]
            const id = match[2]
            const key = kind + ":" + id
            if (seen.has(key)) continue
            seen.add(key)
            mentions.push({ kind, id })
        }
    }
    return mentions
}

/**
 * Lint: bare known ids in a single-backtick span, e.g. `` `data-insight` `` —
 * a component, template or guide id that appears as ordinary code instead of
 * the explicit `{.id}`/`{guide:id}`/`{template:id}` mention syntax. Meant to
 * fail the build (see `main` in generate-gdocs-references.ts), naming the
 * explicit form the author should have written. When an id is known as more
 * than one kind, component wins over template over guide, matching
 * `resolveMentions`'s prefix ordering.
 */
export function findBareKnownIds(
    texts: (string | undefined)[],
    known: KnownIds
): { id: string; kind: RelatedRefKind }[] {
    const seen = new Set<string>()
    const found: { id: string; kind: RelatedRefKind }[] = []
    for (const text of texts) {
        if (!text) continue
        const prose = text.replace(FENCED_BLOCK, "")
        for (const match of prose.matchAll(BARE_SPAN)) {
            const id = match[1]
            const kind = BARE_LOOKUP_KINDS.find((k) => known[k].has(id))
            if (!kind) continue
            const key = kind + ":" + id
            if (seen.has(key)) continue
            seen.add(key)
            found.push({ id, kind })
        }
    }
    return found
}

/** Formats a ref the way an author writes it, for error messages */
export function mentionSyntax(ref: RelatedRef): string {
    return "{" + PREFIX_BY_KIND[ref.kind] + ref.id + "}"
}

export function resolveMentions(
    mentions: RelatedRef[],
    known: KnownIds,
    file: string,
    self?: RelatedRef
): RelatedRef[] {
    const resolved: RelatedRef[] = []
    for (const mention of mentions) {
        if (self && mention.kind === self.kind && mention.id === self.id)
            continue
        if (!known[mention.kind].has(mention.id))
            throw new Error(
                file +
                    ": mentions unknown " +
                    mention.kind +
                    ' "' +
                    mentionSyntax(mention) +
                    '"'
            )
        resolved.push(mention)
    }
    return resolved
}
