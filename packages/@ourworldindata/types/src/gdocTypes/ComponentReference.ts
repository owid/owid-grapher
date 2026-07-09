// Types for the generated ArchieML component reference registry.
// Produced by devTools/gdocs/generate-gdocs-references.ts (committed to
// docs/components.registry.generated.json) and consumed by the admin
// components reference page via the /api/components.json endpoint.

export interface ComponentExample {
    name: string
    archie: string
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
}
