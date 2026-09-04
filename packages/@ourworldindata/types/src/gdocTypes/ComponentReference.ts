// Types for the generated ArchieML component reference registry.
// Produced by devTools/gdocs/generate-gdocs-references.ts (committed to
// docs/components.registry.generated.json) and consumed by the admin
// components reference page via the /api/gdocs-reference/components.json endpoint.

export interface ComponentExample {
    archie: string
}

/**
 * A sidecar's prose, split into its declared sections by the generator (see
 * devTools/gdocs/sidecarSections.ts for the vocabulary and the rules). The
 * split happens exactly once, at generation time, so the reference page
 * renders these fields instead of re-parsing markdown headings.
 */
export interface SidecarProse {
    /** Everything before the first section heading; fenced examples live here */
    intro: string
    /** Decision prose: what the block is the right choice for */
    whenToUse?: string
    /** Decision prose: when to reach for something else */
    whenNotToUse?: string
    /**
     * The "## Notes" section (heading dropped — the notes area carries its
     * own title) followed by any free-form sections, headings intact.
     */
    notes?: string
}

/** Every piece of a sidecar's prose as one string, for search indexing. */
export function proseText(prose: SidecarProse): string {
    return [prose.intro, prose.whenToUse, prose.whenNotToUse, prose.notes]
        .filter(Boolean)
        .join("\n\n")
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

/**
 * One property of a block, as declared on its type alias — the derived,
 * exhaustive replacement for hand-written "x is optional" prose. Rendered as
 * the properties table on the component page, joined at request time with
 * per-prop adoption computed from published content.
 */
export interface ComponentPropDoc {
    name: string
    /** Declared type text as written in the source, e.g. `"info"` or `string` */
    type: string
    optional: boolean
    /**
     * What setting this property does, and what happens when it is omitted
     * — authored in the sidecar's "## Properties" section, which the
     * generator checks against this derived prop list. The types state what
     * a property *is*; this states the effect of changing it.
     */
    description?: string
}

/**
 * Shape of docs/components.registry.generated.json and of the
 * /api/gdocs-reference/components.json response.
 */
export interface ComponentRegistry {
    components: ComponentDoc[]
    /**
     * Repo-relative source file of every named type mentioned in the prop
     * type texts, so the UI can link a type name to its definition.
     */
    typeSources: Record<string, string>
}

export interface ComponentDoc {
    id: string
    title: string
    typeName: string
    category: ComponentCategory
    sourceFile: string
    sidecarFile: string
    prose: SidecarProse
    examples: ComponentExample[]
    /** Every declared property of the block, derived from its type alias */
    props: ComponentPropDoc[]
    /**
     * Props whose VALUE (not just presence) distinguishes forms of the
     * block, derived from the declared types: literal unions, enums,
     * const-array unions, numbers and booleans. Consumed by the live
     * variation analysis ("size:narrow" is a different form than
     * "size:wide", but two charts with different urls are the same form).
     */
    valueProps: string[]
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
