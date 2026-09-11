import * as React from "react"

import { AdminLayout } from "./AdminLayout.js"
import { DatasetList } from "./DatasetList.js"
import { useListSearch } from "./adminTableHelpers.js"
import { DatasetListItem, useDatasets } from "./datasetQueries.js"
import { SearchField } from "../adminShared/searchFilter.js"

const SEARCH_FIELDS: SearchField<DatasetListItem>[] = [
    {
        name: "name",
        type: "string",
        description: "Dataset name",
        get: (d) => d.name,
    },
    {
        name: "short",
        type: "string",
        description: "Short name",
        get: (d) => d.shortName,
    },
    {
        name: "namespace",
        type: "string",
        description: "Namespace",
        get: (d) => d.namespace,
    },
    {
        name: "version",
        type: "string",
        description: "Version",
        get: (d) => d.version,
    },
    {
        name: "tag",
        type: "string",
        description: "Tag",
        get: (d) => d.tags.map((tag) => tag.name),
    },
    {
        name: "by",
        type: "string",
        description: "Who last edited the data",
        get: (d) => d.dataEditedByUserName,
    },
    {
        name: "notes",
        type: "string",
        description: "Notes",
        get: (d) => d.description,
    },
    {
        name: "charts",
        type: "number",
        description: "Number of charts using it",
        get: (d) => d.numCharts,
    },
    {
        name: "private",
        type: "boolean",
        description: "Unpublished",
        get: (d) => d.isPrivate,
    },
    {
        name: "redistributable",
        type: "boolean",
        description: "Redistribution allowed",
        get: (d) => !d.nonRedistributable,
    },
    {
        name: "uploaded",
        type: "date",
        description: "When the data was last edited",
        get: (d) => d.dataEditedAt,
    },
]

export function DatasetsIndexPage(): React.ReactElement {
    const { data: datasets, isLoading } = useDatasets()
    const { results, highlight, search } = useListSearch(
        datasets,
        SEARCH_FIELDS,
        { placeholder: "Search all datasets...", autoFocus: true }
    )

    return (
        <AdminLayout title="Datasets">
            <main className="DatasetsIndexPage">
                <DatasetList
                    datasets={results}
                    searchHighlight={highlight}
                    loading={isLoading}
                    search={search}
                />
            </main>
        </AdminLayout>
    )
}
