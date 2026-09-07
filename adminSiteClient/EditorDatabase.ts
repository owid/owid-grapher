import { observable, makeObservable } from "mobx"

interface Variable {
    id: number
    name: string
}

export interface Dataset {
    id: number
    name: string
    namespace: string
    version: string | undefined
    variables: Variable[]
    isPrivate: boolean
    nonRedistributable: boolean
}

export interface Namespace {
    name: string
    description?: string
    isArchived: boolean
}

// This contains the dataset/variable metadata for the entire database
// Used for variable selector interface
export interface NamespaceData {
    datasets: Dataset[]
}

/**
 * Everything the variable selector needs to offer indicators. Produced by an
 * `IndicatorCatalog` (see editorProviders.ts); the admin's catalog is the
 * whole database, other hosts can pass whatever subset they have.
 */
export interface IndicatorCatalogData {
    namespaces: Namespace[]
    datasets: Dataset[]
    /** variableId → number of charts using it. Ranks search results. */
    usageCounts?: Map<number, number>
}

export class EditorDatabase {
    namespaces: Namespace[]
    variableUsageCounts: Map<number, number> = new Map()
    dataByNamespace: Map<string, NamespaceData> = new Map()

    constructor(data: IndicatorCatalogData) {
        makeObservable(this, {
            namespaces: observable.ref,
            variableUsageCounts: observable.ref,
            dataByNamespace: observable,
        })
        this.namespaces = data.namespaces
        this.variableUsageCounts = data.usageCounts ?? new Map()
        for (const dataset of data.datasets) {
            const entry = this.dataByNamespace.get(dataset.namespace)
            if (entry) entry.datasets.push(dataset)
            else
                this.dataByNamespace.set(dataset.namespace, {
                    datasets: [dataset],
                })
        }
    }

    static empty(): EditorDatabase {
        return new EditorDatabase({ namespaces: [], datasets: [] })
    }

    get isEmpty(): boolean {
        return this.namespaces.length === 0
    }
}
