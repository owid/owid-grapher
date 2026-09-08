// Types for the generated gdoc guides registry: cross-cutting concepts of
// writing in Google Docs (refs, details on demand, headings …) that are
// neither a block nor a document type. Produced by
// devTools/gdocs/generate-gdocs-references.ts (committed to
// docs/guides.registry.generated.json) and served via the
// /api/gdocs-reference/guides.json endpoint.

import type {
    RelatedRef,
    SidecarExample,
    SidecarProse,
} from "./ComponentReference.js"

/** Author-facing grouping of the guides, in presentation order. */
export const GUIDE_CATEGORIES = [
    "Writing",
    "Structure",
    "Charts & data",
    "Publishing",
] as const

export type GuideCategory = (typeof GUIDE_CATEGORIES)[number]

export interface GuideReference {
    /** The sidecar file name without extension, e.g. "refs" */
    id: string
    title: string
    category: GuideCategory
    sidecarFile: string
    /** First paragraph of the intro as plain text — the card subtitle */
    description: string
    prose: SidecarProse
    /** Validated, never rendered: the client shows them as code */
    examples: SidecarExample[]
    related?: RelatedRef[]
}
