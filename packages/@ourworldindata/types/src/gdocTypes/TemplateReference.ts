// Types for the generated gdoc template reference registry.
// Produced by devTools/gdocs/generate-gdocs-references.ts (committed to
// docs/templates.registry.generated.json) and served to agents/tools via the
// /api/templates.json endpoint: one entry per gdoc type the ArchieML
// write-back layer can create or edit.

import type { ComponentExample } from "./ComponentReference.js"
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
    examples: ComponentExample[]
}
