/*
 * The document model of the gdocs writing reference: what `buildModel.ts`
 * produces from the committed registries. A library is one index document
 * plus one document per component, template and guide, each held as the
 * Markdown string that is uploaded as its plain `.md` file in Drive and
 * printed by --dry-run.
 */

import type { RelatedRef } from "@ourworldindata/types"

/** The kinds of item that get a document of their own */
export type ReferenceItemKind = RelatedRef["kind"]

/** Every document in the library: the three item kinds plus the index */
export type ReferenceDocKind = ReferenceItemKind | "index"

/** Identifies one document of the library (the index is `{ kind: "index", id: "index" }`) */
export interface DocRef {
    kind: ReferenceDocKind
    id: string
}

export const INDEX_REF: DocRef = { kind: "index", id: "index" }

/** The URL of a library document, when it is known (never under --dry-run) */
export type UrlFor = (ref: DocRef) => string | undefined

/** One library file: its Drive file name and its content as Markdown */
export interface ReferenceDoc {
    docTitle: string
    markdown: string
}

/** The document of one component, template or guide */
export interface ReferenceItemDoc extends ReferenceDoc {
    kind: ReferenceItemKind
    id: string
    /** The item's own title ("Chart"), as opposed to the Drive name */
    title: string
}

/** The whole library: one index plus one document per item */
export interface ReferenceLibrary {
    index: ReferenceDoc
    items: ReferenceItemDoc[]
}
