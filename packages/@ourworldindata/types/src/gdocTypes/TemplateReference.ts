// Types for the generated gdoc template reference registry.
// Produced by devTools/gdocs/generate-gdocs-references.ts (committed to
// docs/templates.registry.generated.json) and served to agents/tools via the
// /api/gdocs-reference/templates.json endpoint: one entry per gdoc type the ArchieML
// write-back layer can create or edit.

import type { GdocContentKeyFate } from "./Gdoc.js"

export interface TemplateFieldDoc {
    name: string
    /** TypeScript type text as declared on the content interface */
    type: string
    optional: boolean
    /** What the ArchieML write-back does with the key (see GdocContentKeyFate) */
    writeBack: GdocContentKeyFate
    description?: string
}

/**
 * One named part of a template's canonical structure, curated in the template
 * sidecar front matter. Deliberately abstract — it describes the shape of the
 * document type, not any specific document, so it survives content churn.
 */
export interface TemplateSkeletonPart {
    name: string
    description: string
    /** Component ids typically used in this part (validated by the generator) */
    components: string[]
    /** The part occurs multiple times (e.g. an article's sections) */
    repeats?: boolean
}

export interface TemplateDoc {
    /** The OwidGdocType value, e.g. "article" */
    id: string
    /** The content interface these fields are extracted from */
    contentTypeName: string
    sidecarFile: string
    title: string
    body: string
    fields: TemplateFieldDoc[]
    /** Gdoc properties managed in the admin, never authored in the document */
    adminManagedFields: string[]
    /**
     * Slugs of editorially chosen published documents whose structure
     * exemplifies the type; resolved live by the admin server into a
     * section-level outline.
     */
    exemplars?: string[]
    /**
     * The canonical structure of the document type, curated in the sidecar.
     * The scaffold for new documents — templates carry no synthetic example
     * documents.
     */
    skeleton: TemplateSkeletonPart[]
}
