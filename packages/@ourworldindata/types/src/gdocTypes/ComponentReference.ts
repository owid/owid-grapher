// Types for the generated ArchieML component reference registry.
// Produced by devTools/gdocs/generate-gdocs-references.ts (committed to
// docs/components.registry.generated.json) and consumed by the admin
// components reference page via the /api/components.json endpoint.

export interface ComponentExample {
    name: string
    archie: string
}

/**
 * A curated pointer to a real usage of the component in a published document,
 * authored in the sidecar front matter and resolved live by the admin server.
 */
export interface PinnedExampleRef {
    /** Slug of the published document the example lives in */
    slug: string
    /** 1-based occurrence of the component within that document (default 1) */
    nth?: number
}

/**
 * Author-facing grouping of the ArchieML components, in the order the admin
 * reference page presents them. The generator enforces that every component
 * is assigned to exactly one of these.
 */
export const COMPONENT_CATEGORIES = [
    "Text & structure",
    "Charts & data",
    "Media",
    "Layout & sections",
    "Links & related content",
    "Topic pages",
    "People",
    "Special pages",
] as const

export type ComponentCategory = (typeof COMPONENT_CATEGORIES)[number]

export interface ComponentDoc {
    id: string
    title: string
    typeName: string
    category: ComponentCategory
    sourceFile: string
    sidecarFile: string
    body: string
    examples: ComponentExample[]
    /**
     * Platform block rendered on system-managed pages (homepage, cookie
     * notice, …) — never part of an author's vocabulary. The one editorial
     * judgment usage data can't express: zero usage is ambiguous between
     * "system block, don't touch" and "brand new, please use".
     */
    system?: boolean
    /** Component ids an author might consider instead ("choose this vs …") */
    related?: string[]
    /** Curated real examples, resolved live by the admin server */
    pinned?: PinnedExampleRef[]
}
