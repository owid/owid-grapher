import * as React from "react"
import { useContext, useMemo, useState } from "react"
import { Button } from "antd"
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

/** `grapher/who/2026-05-22/gho/gho#x` -> `who` */
function namespaceOf(catalogPath: string | undefined): string | undefined {
    return catalogPath?.replace(/^grapher\//, "").split("/")[0]
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
    const [hasTyped, setHasTyped] = useState(false)

    const [chosen, setChosen] = useState<VariableListItem[]>(() =>
        slot.dimensions.map((dimension) => ({
            id: dimension.variableId,
            name: dimension.column.name,
            datasetName: dimension.column.datasetName,
        }))
    )
    const [hasLookedUp, setHasLookedUp] = useState(false)

    // The slot knows its indicators' ids and little else. Looking them up
    // gives the namespace to open on, so the dataset a chart already draws
    // from is the first thing you see, with its indicators ticked — the
    // namespace dropdown used to do that invisibly.
    const initialIds = useMemo(
        () => slot.dimensions.map((dimension) => dimension.variableId),
        [slot]
    )
    const { data: current } = useQuery({
        queryKey: ["variable-selector-current", initialIds],
        queryFn: () =>
            admin.getJSONInBackground<{ variables: VariableListItem[] }>(
                "/api/variables.json",
                { ids: initialIds.join(",") }
            ),
        enabled: initialIds.length > 0,
    })

    // Replaces the sparse versions from the slot with the full rows, once,
    // so ticking something before the lookup lands is not undone
    if (current && !hasLookedUp) {
        setHasLookedUp(true)
        setChosen((existing) =>
            existing.map(
                (variable) =>
                    current.variables.find((row) => row.id === variable.id) ??
                    variable
            )
        )
    }

    const seededNamespace = current?.variables
        .map((variable) => namespaceOf(variable.catalogPath))
        .find(Boolean)
    const seed = seededNamespace ? `namespace:${seededNamespace}` : ""
    // Only until the first keystroke, so the seed never fights what is typed
    const effectiveSearch = hasTyped ? debouncedSearch : seed

    const { data, isFetching } = useQuery({
        queryKey: ["variable-selector", effectiveSearch, page],
        queryFn: () =>
            admin.getJSONInBackground<{
                datasets: DatasetSearchGroup[]
                numTotalDatasets: number
                numTotalRows: number
            }>("/api/variables.json", {
                search: effectiveSearch,
                group: "dataset",
                limit: DATASETS_PER_PAGE,
                offset: (page - 1) * DATASETS_PER_PAGE,
            }),
        placeholderData: keepPreviousData,
    })

    const searchWords = useMemo(
        () => searchWordsToHighlight(effectiveSearch, SEARCH_FIELDS),
        [effectiveSearch]
    )

    const selectedIds = useMemo(
        () => new Set(chosen.map((variable) => variable.id)),
        [chosen]
    )

    const selection = useMemo(
        () => ({
            selectedIds,
            onToggle: (variable: VariableListItem) =>
                setChosen((existing) => {
                    if (existing.some((chosen) => chosen.id === variable.id))
                        return existing.filter(
                            (chosen) => chosen.id !== variable.id
                        )
                    // a slot that takes one indicator swaps rather than adds
                    return slot.allowMultiple
                        ? [...existing, variable]
                        : [variable]
                }),
        }),
        [selectedIds, slot.allowMultiple]
    )

    // Pinned above the results, so what the chart already uses — and anything
    // just ticked — stays visible and untickable however the search narrows
    const groups: DatasetSearchGroup[] = useMemo(() => {
        const found = data?.datasets ?? []
        if (chosen.length === 0) return found
        const pinned: DatasetSearchGroup = {
            id: -1,
            pinned: true,
            name: `Chosen for ${slot.name} (${chosen.length})`,
            namespace: "",
            version: null,
            shortName: null,
            matchCount: chosen.length,
            variables: chosen,
        }
        // never twice: a chosen indicator is dropped from its dataset's group
        const withoutChosen = found.map((group) => ({
            ...group,
            variables: group.variables.filter(
                (variable) => !selectedIds.has(variable.id)
            ),
        }))
        return [pinned, ...withoutChosen]
    }, [data, chosen, selectedIds, slot.name])

    const onSearch = (value: string) => {
        setHasTyped(true)
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
                        groups={groups}
                        isSearch={effectiveSearch.trim().length > 0}
                        searchWords={searchWords}
                        searchValue={effectiveSearch}
                        onSearchValue={onSearch}
                        loading={isFetching}
                        selection={selection}
                        search={{
                            value: hasTyped ? searchValue : seed,
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
