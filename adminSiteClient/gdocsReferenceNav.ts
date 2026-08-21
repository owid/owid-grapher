import {
    ComponentUsageByDocType,
    GdocsReferenceUsage,
} from "@ourworldindata/types"

/**
 * The sidebar's template-as-filter scope: a template id narrows the component
 * list to the blocks actually used in that document type, ranked by adoption
 * within it. Pure — the page component feeds it observables and renders the
 * result.
 */

export interface ScopedNavComponent<T> {
    doc: T
    /** The template's own adoption entry — the dots and tooltip speak it */
    entry: ComponentUsageByDocType
}

export function componentsUsedInTemplate<
    T extends { id: string; title: string; system?: boolean },
>(
    components: T[],
    usage: GdocsReferenceUsage | undefined | null,
    templateId: string
): ScopedNavComponent<T>[] {
    if (!usage) return []
    const entryByComponentId = new Map<string, ComponentUsageByDocType>()
    for (const componentUsage of usage.components) {
        const entry = componentUsage.byDocType.find(
            (entry) => entry.docType === templateId && entry.docsUsingIt > 0
        )
        if (entry) entryByComponentId.set(componentUsage.componentId, entry)
    }
    return components
        .filter((doc) => !doc.system)
        .flatMap((doc) => {
            const entry = entryByComponentId.get(doc.id)
            return entry ? [{ doc, entry }] : []
        })
        .sort(
            (a, b) =>
                b.entry.docsUsingIt - a.entry.docsUsingIt ||
                a.doc.title.localeCompare(b.doc.title)
        )
}
