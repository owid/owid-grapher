// Shapes for the live (database-computed) part of the admin writing
// reference: component usage across published documents, real component
// instances with provenance, observed configuration variations, and the
// section-level outline of a template's exemplar document.
//
// Everything here is computed at request time from posts_gdocs /
// posts_gdocs_components — none of it is baked into the generated registries,
// so it cannot go stale.

import type { OwidGdocType } from "./Gdoc.js"
import type { PinnedExampleRef } from "./ComponentReference.js"

/**
 * Qualitative adoption label for a component within one document type,
 * derived from the fraction of published docs of that type using it.
 * The UI leads with these words; raw fractions are tooltip material.
 */
export const COMPONENT_USAGE_LABELS = [
    "standard", // ≥40% of published docs of the type
    "common", // ≥10%
    "occasional", // ≥2%
    "rare", // >0
    "unused",
] as const

export type ComponentUsageLabel = (typeof COMPONENT_USAGE_LABELS)[number]

export interface ComponentUsageByDocType {
    docType: OwidGdocType
    docsUsingIt: number
    totalDocs: number
    label: ComponentUsageLabel
}

export interface ComponentUsage {
    componentId: string
    /** Published docs (of any type) using the component at least once */
    docsUsingIt: number
    /** Total occurrences across all published docs */
    totalUses: number
    byDocType: ComponentUsageByDocType[]
}

export interface GdocsReferenceUsage {
    /** Only components that occur in at least one published doc appear here */
    components: ComponentUsage[]
    /** Published doc counts per type — the denominators behind the labels */
    totalDocsByType: Partial<Record<OwidGdocType, number>>
}

/** A real occurrence of a component in a published document */
export interface ComponentInstance {
    gdocId: string
    slug: string
    title: string
    docType: OwidGdocType
    /** JSON path of the block within the document content, e.g. "$.body[3]" */
    path: string
    /**
     * Anchor of the nearest heading above the block on the live page —
     * appended to the live URL so authors land on the section using it.
     */
    anchor?: string
    publishedAt: string | null
    /** Signature of the observed configuration shape (see ComponentVariation) */
    variation: string
    /**
     * The ArchieML an author would write to produce this block — converted
     * from the stored config. Populated for the instances a response actually
     * shows (pinned, page, variation representatives), not for counts.
     */
    archie?: string
}

/**
 * One observed configuration shape of a component: the set of authored
 * optional props (plus salient scalar values like a chart's size), as it
 * actually occurs in published content. Only observed forms exist — the
 * schema is never exploded combinatorially.
 */
export interface ComponentVariation {
    /** Stable signature, e.g. "caption+size:narrow"; "" is the bare form */
    signature: string
    /** Number of published instances with this shape */
    count: number
    /** A real instance demonstrating the form */
    representative: ComponentInstance
}

/**
 * A sidecar (synthetic) example matched against production: when its form is
 * not observed in any published doc, the UI presents it as a synthetic
 * variation with a distinct "not used in any published doc yet" treatment —
 * synthetic examples cover exactly the gap reality leaves.
 */
export interface SyntheticExampleInfo {
    /** Index into the registry doc's examples array */
    exampleIndex: number
    name: string
    signature: string
    /** Whether this form occurs in published content */
    observed: boolean
}

export interface ComponentInstancesResponse {
    componentId: string
    /** Total instances matching the docType/variation filter */
    total: number
    instances: ComponentInstance[]
    /** All observed shapes of the component, most frequent first (unfiltered) */
    variations: ComponentVariation[]
    /** Resolved curated examples, in sidecar order */
    pinned: ComponentInstance[]
    /** Sidecar pins that no longer resolve — surfaced to editors as stale */
    stalePins: PinnedExampleRef[]
    /** The registry examples matched against the observed variations */
    syntheticExamples: SyntheticExampleInfo[]
}

/** A block inside an exemplar section, addressable for preview rendering */
export interface ExemplarBlock {
    componentId: string
    path: string
}

/**
 * One section of an exemplar document — the x-ray operates at this altitude,
 * not at block level. Consecutive sections with an identical composition are
 * rolled up into a single entry with `repeats` > 1.
 */
export interface ExemplarSection {
    /** Plain text of the heading opening the section (absent for the intro) */
    heading?: string
    /** Anchor of that heading on the live page */
    anchor?: string
    /** componentId → occurrence count within the section */
    composition: Record<string, number>
    /** Block-level detail for the drill-in view */
    blocks: ExemplarBlock[]
    /** >1 when consecutive same-shaped sections are collapsed into this one */
    repeats?: number
}

/** The live section outline of one exemplar document */
export interface ExemplarOutline {
    slug: string
    title: string
    docType: OwidGdocType
    publishedAt: string | null
    sections: ExemplarSection[]
}

export interface TemplateExemplarsResponse {
    templateId: string
    exemplars: ExemplarOutline[]
    /** Sidecar exemplar slugs that are not published — stale, for editors */
    staleExemplars: string[]
}
