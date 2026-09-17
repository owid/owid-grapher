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
    VariableList,
    VariableListItem,
} from "./VariableList.js"
import {
    SearchFieldHelp,
    searchWordsToHighlight,
} from "../adminShared/searchFilter.js"

/** Datasets per page, each showing its most-read handful of indicators. */
const DATASETS_PER_PAGE = 8

/** Indicators per page once a search has narrowed to a single dataset. */
const INDICATORS_PER_PAGE = 20

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

/** `grapher/who/2026-05-22/gho/gho#x` -> ["who", "2026-05-22", "gho"] */
function pathSegments(catalogPath: string | undefined): string[] {
    return catalogPath?.replace(/^grapher\//, "").split("/") ?? []
}

/** The dataset segment, which `dataset:` searches. */
function datasetOf(catalogPath: string | undefined): string | undefined {
    return pathSegments(catalogPath)[2]
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
    // gives the dataset to open on: 57% of charts with several indicators
    // take them all from one dataset, so that is where the next one is
    // likeliest to come from. A chart already spanning several datasets gets
    // no seed — 92% of those cross a namespace boundary too, so any guess we
    // made would hide more than it found.
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

    const seededDatasets = new Set(
        (current?.variables ?? [])
            .map((variable) => datasetOf(variable.catalogPath))
            .filter((dataset) => dataset !== undefined)
    )
    const seed =
        seededDatasets.size === 1 ? `dataset:${[...seededDatasets][0]}` : ""
    // Only until the first keystroke, so the seed never fights what is typed
    const effectiveSearch = hasTyped ? debouncedSearch : seed

    // Grouping a single dataset would only cap it at five again, so naming
    // one switches to the flat list and pages through its indicators — the
    // same rule the indicators page uses.
    const isGrouped = !/\bdataset:/.test(effectiveSearch)

    // The datasets this chart already draws from stay on the first page of
    // results however the search ranks them. Without this, searching a broad
    // word puts them beyond page one and the group above shows the chart's
    // own indicators with none of the ones just searched for.
    const pinnedDatasetIds = useMemo(
        () =>
            [
                ...new Set(
                    chosen
                        .map((variable) => variable.datasetId)
                        .filter((id) => id !== undefined)
                ),
            ].join(","),
        [chosen]
    )

    const { data, isFetching } = useQuery({
        queryKey: [
            "variable-selector",
            effectiveSearch,
            page,
            pinnedDatasetIds,
        ],
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
                pinnedDatasetIds,
            }),
        // The seed is only known once the lookup lands. Searching before then
        // would spend a query on results nobody sees.
        enabled:
            isGrouped && (hasTyped || initialIds.length === 0 || hasLookedUp),
        placeholderData: keepPreviousData,
    })

    const flat = useQuery({
        queryKey: ["variable-selector-flat", effectiveSearch, page],
        queryFn: () =>
            admin.getJSONInBackground<{
                variables: VariableListItem[]
                numTotalRows: number
            }>("/api/variables.json", {
                search: effectiveSearch,
                limit: INDICATORS_PER_PAGE,
                offset: (page - 1) * INDICATORS_PER_PAGE,
            }),
        enabled:
            !isGrouped && (hasTyped || initialIds.length === 0 || hasLookedUp),
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

    // The chart's own indicators lead the results, under their dataset like
    // any other group, so what a chart already draws reads the same as
    // everything else. A dataset that also matches the search keeps its own
    // count and its other indicators below the chosen ones.
    const groups: DatasetSearchGroup[] = useMemo(() => {
        const found = data?.datasets ?? []
        if (chosen.length === 0) return found

        const chosenByDataset = new Map<number, VariableListItem[]>()
        for (const variable of chosen) {
            const datasetId = variable.datasetId ?? -1
            chosenByDataset.set(datasetId, [
                ...(chosenByDataset.get(datasetId) ?? []),
                variable,
            ])
        }

        const leading: DatasetSearchGroup[] = []
        for (const [datasetId, variables] of chosenByDataset) {
            const fromSearch = found.find((group) => group.id === datasetId)
            const [namespace, version, dataset] = pathSegments(
                variables[0].catalogPath
            )
            leading.push({
                id: datasetId,
                name:
                    fromSearch?.name ??
                    variables[0].datasetName ??
                    "Chosen indicators",
                namespace: fromSearch?.namespace ?? namespace ?? "",
                version: fromSearch?.version ?? version ?? null,
                shortName: fromSearch?.shortName ?? dataset ?? null,
                uploadedAt: fromSearch?.uploadedAt ?? variables[0].uploadedAt,
                uploadedBy: fromSearch?.uploadedBy ?? variables[0].uploadedBy,
                matchCount: fromSearch?.matchCount ?? variables.length,
                // chosen first, then whatever else that dataset matched
                variables: [
                    ...variables,
                    ...(fromSearch?.variables ?? []).filter(
                        (variable) => !selectedIds.has(variable.id)
                    ),
                ],
                pinned: datasetId < 0 || !fromSearch,
            })
        }

        const rest = found
            .filter((group) => !chosenByDataset.has(group.id))
            .map((group) => ({
                ...group,
                variables: group.variables.filter(
                    (variable) => !selectedIds.has(variable.id)
                ),
            }))
        return [...leading, ...rest]
    }, [data, chosen, selectedIds])

    const onSearch = (value: string) => {
        setHasTyped(true)
        setSearchValue(value)
        setPage(1)
    }

    const searchProps = {
        value: hasTyped ? searchValue : seed,
        onChange: onSearch,
        placeholder: "Search indicators, e.g. namespace:who deaths",
        autoFocus: true,
        width: 420,
        fields: SEARCH_FIELDS,
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
                    {isGrouped ? (
                        <GroupedVariableList
                            groups={groups}
                            isSearch={effectiveSearch.trim().length > 0}
                            searchWords={searchWords}
                            searchValue={effectiveSearch}
                            onSearchValue={onSearch}
                            loading={isFetching}
                            selection={selection}
                            search={searchProps}
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
                                            {(page - 1) * DATASETS_PER_PAGE + 1}
                                            –
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
                    ) : (
                        <VariableList
                            variables={flat.data?.variables ?? []}
                            fields={["usage"]}
                            searchWords={searchWords}
                            loading={flat.isFetching}
                            sortable={false}
                            selection={selection}
                            search={searchProps}
                            pagination={{
                                current: page,
                                pageSize: INDICATORS_PER_PAGE,
                                total: flat.data?.numTotalRows ?? 0,
                                showSizeChanger: false,
                                onChange: setPage,
                            }}
                        />
                    )}
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
