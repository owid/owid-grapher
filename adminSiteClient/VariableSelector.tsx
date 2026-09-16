import * as React from "react"
import { useContext, useMemo, useState } from "react"
import { Button, Checkbox } from "antd"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useDebounceValue } from "usehooks-ts"
import { OwidVariableId } from "@ourworldindata/utils"
import { DimensionSlot } from "@ourworldindata/grapher"

import { Modal } from "./Forms.js"
import { AdminAppContext } from "./AdminAppContext.js"
import {
    DatasetSearchGroup,
    GroupedVariableList,
    VariableListItem,
} from "./VariableList.js"
import {
    SearchFieldHelp,
    searchWordsToHighlight,
} from "../adminShared/searchFilter.js"

/** Datasets per page, each showing its most-read handful of indicators. */
const DATASETS_PER_PAGE = 8

/** Mirrors the indicators list — one search answers both. */
const SEARCH_FIELDS: SearchFieldHelp[] = [
    { name: "name", type: "string", description: "Indicator name (regex)" },
    { name: "path", type: "string", description: "Catalog path (regex)" },
    {
        name: "namespace",
        type: "string",
        description: "Namespace, the first segment of the path",
    },
    { name: "version", type: "string", description: "Version segment" },
    { name: "dataset", type: "string", description: "Dataset segment" },
    { name: "table", type: "string", description: "Table segment" },
    { name: "short", type: "string", description: "Indicator short name" },
    { name: "datasetname", type: "string", description: "The dataset's title" },
    { name: "is", type: "string", description: "`public` or `private`" },
]

interface ChosenVariable {
    id: number
    name: string
    datasetName?: string
}

interface VariableSelectorProps {
    slot: DimensionSlot
    onDismiss: () => void
    onComplete: (variableIds: OwidVariableId[]) => void
}

/**
 * Picks indicators for a chart's dimension slot, off the same search as
 * /admin/variables: the same query grammar, the same grouping by dataset, the
 * same ranking by how much our readers use an indicator.
 *
 * It asks the database rather than filtering a copy of every indicator in the
 * browser, which is what the chart editor used to download on each load.
 */
export function VariableSelector({
    slot,
    onDismiss,
    onComplete,
}: VariableSelectorProps): React.ReactElement {
    const { admin } = useContext(AdminAppContext)
    const [searchValue, setSearchValue] = useState("")
    const [page, setPage] = useState(1)
    const [debouncedSearch] = useDebounceValue(searchValue, 250)

    const [chosen, setChosen] = useState<ChosenVariable[]>(() =>
        slot.dimensions.map((dimension) => ({
            id: dimension.variableId,
            name: dimension.column.name,
            datasetName: dimension.column.datasetName,
        }))
    )

    const { data, isFetching } = useQuery({
        queryKey: ["variable-selector", debouncedSearch, page],
        queryFn: () =>
            admin.getJSONInBackground<{
                datasets: DatasetSearchGroup[]
                numTotalDatasets: number
                numTotalRows: number
            }>("/api/variables.json", {
                search: debouncedSearch,
                group: "dataset",
                limit: DATASETS_PER_PAGE,
                offset: (page - 1) * DATASETS_PER_PAGE,
            }),
        placeholderData: keepPreviousData,
    })

    const searchWords = useMemo(
        () => searchWordsToHighlight(debouncedSearch, SEARCH_FIELDS),
        [debouncedSearch]
    )

    const selectedIds = useMemo(
        () => new Set(chosen.map((variable) => variable.id)),
        [chosen]
    )

    const unselect = (id: number) =>
        setChosen((current) => current.filter((chosen) => chosen.id !== id))

    const selection = useMemo(
        () => ({
            selectedIds,
            onToggle: (variable: VariableListItem) =>
                setChosen((current) => {
                    if (current.some((chosen) => chosen.id === variable.id))
                        return current.filter(
                            (chosen) => chosen.id !== variable.id
                        )
                    const added = {
                        id: variable.id,
                        name: variable.name,
                        datasetName: variable.datasetName,
                    }
                    // a slot that takes one indicator swaps rather than adds
                    return slot.allowMultiple ? [...current, added] : [added]
                }),
        }),
        [selectedIds, slot.allowMultiple]
    )

    const onSearch = (value: string) => {
        setSearchValue(value)
        setPage(1)
    }

    const totalDatasets = data?.numTotalDatasets ?? 0
    const lastPage = Math.ceil(totalDatasets / DATASETS_PER_PAGE)

    return (
        <Modal onClose={onDismiss} className="VariableSelector">
            <div className="modal-header">
                <h5 className="modal-title">
                    Set indicator{slot.allowMultiple && "s"} for {slot.name}
                </h5>
            </div>
            <div className="modal-body">
                <div className="VariableSelector__results">
                    <GroupedVariableList
                        groups={data?.datasets ?? []}
                        isSearch={debouncedSearch.trim().length > 0}
                        searchWords={searchWords}
                        searchValue={debouncedSearch}
                        onSearchValue={onSearch}
                        loading={isFetching}
                        selection={selection}
                        search={{
                            value: searchValue,
                            onChange: onSearch,
                            placeholder:
                                "Search indicators, e.g. namespace:who deaths",
                            autoFocus: true,
                            width: 420,
                            fields: SEARCH_FIELDS,
                        }}
                        footer={
                            lastPage > 1 && (
                                <div className="VariableSelector__paging">
                                    <Button
                                        size="small"
                                        disabled={page === 1}
                                        onClick={() => setPage(page - 1)}
                                    >
                                        Previous
                                    </Button>
                                    <span>
                                        datasets{" "}
                                        {(page - 1) * DATASETS_PER_PAGE + 1}–
                                        {Math.min(
                                            page * DATASETS_PER_PAGE,
                                            totalDatasets
                                        )}{" "}
                                        of {totalDatasets}
                                    </span>
                                    <Button
                                        size="small"
                                        disabled={page >= lastPage}
                                        onClick={() => setPage(page + 1)}
                                    >
                                        Next
                                    </Button>
                                </div>
                            )
                        }
                    />
                </div>
                <div className="selectedData">
                    <ul>
                        {chosen.map((variable) => (
                            <li key={variable.id}>
                                <Checkbox
                                    checked
                                    onChange={() => unselect(variable.id)}
                                >
                                    {variable.name}{" "}
                                    {variable.datasetName && (
                                        <span className="VariableSelector__chosen-dataset">
                                            [{variable.datasetName}]
                                        </span>
                                    )}
                                </Checkbox>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
            <div className="modal-footer">
                <button className="btn" onClick={onDismiss}>
                    Close
                </button>
                <button
                    className="btn btn-success"
                    onClick={() =>
                        onComplete(chosen.map((variable) => variable.id))
                    }
                >
                    Set variable{slot.allowMultiple && "s"}
                </button>
            </div>
        </Modal>
    )
}
