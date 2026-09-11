import * as React from "react"
import { useMemo } from "react"

import { AdminLayout } from "./AdminLayout.js"
import { DatasetList } from "./DatasetList.js"
import {
    filterBySearchWords,
    highlightSearchWords,
    useSearchQueryParam,
} from "./adminTableHelpers.js"
import { useDatasets } from "./datasetQueries.js"

export function DatasetsIndexPage(): React.ReactElement {
    const { data: datasets, isLoading } = useDatasets()
    const [searchValue, setSearchValue] = useSearchQueryParam()

    const datasetsToShow = useMemo(
        () =>
            filterBySearchWords(datasets ?? [], searchValue, (dataset) => [
                dataset.name,
                dataset.shortName,
                ...dataset.tags.map((t) => t.name),
                dataset.namespace,
                dataset.dataEditedByUserName,
                dataset.description,
            ]),
        [datasets, searchValue]
    )

    const highlight = useMemo(
        () => highlightSearchWords(searchValue),
        [searchValue]
    )

    return (
        <AdminLayout title="Datasets">
            <main className="DatasetsIndexPage">
                <DatasetList
                    datasets={datasetsToShow}
                    searchHighlight={highlight}
                    loading={isLoading}
                    search={{
                        value: searchValue,
                        onChange: setSearchValue,
                        placeholder: "Search all datasets...",
                        autoFocus: true,
                    }}
                />
            </main>
        </AdminLayout>
    )
}
