import * as React from "react"
import { useContext, useMemo, useState } from "react"
import { Alert, Pagination } from "antd"
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
    INDICATOR_SEARCH_FIELDS,
    namesOneDataset,
    parseCatalogPath,
    searchWordsToHighlight,
} from "./variableSearchQuery.js"

/** Datasets per page, each showing its most-read handful of indicators. */
const DATASETS_PER_PAGE = 8

/** Indicators per page once a search has narrowed to a single dataset. */
const INDICATORS_PER_PAGE = 20

/** Rows bucketed by dataset, in the order the datasets first appear. */
function groupByDataset(
    rows: VariableListItem[]
): Map<number, VariableListItem[]> {
    const groups = new Map<number, VariableListItem[]>()
    for (const row of rows) {
        const datasetId = row.datasetId ?? -1
        const group = groups.get(datasetId)
        if (group) group.push(row)
        else groups.set(datasetId, [row])
    }
    return groups
}

/** A dataset group built from what its own rows know about the dataset. */
function groupFromRows(
    datasetId: number,
    rows: VariableListItem[]
): DatasetSearchGroup {
    const [first] = rows
    const path = first.catalogPath
        ? parseCatalogPath(first.catalogPath)
        : undefined
    return {
        id: datasetId,
        name: first.datasetName ?? path?.dataset ?? "Indicators",
        namespace: path?.namespace ?? "",
        version: path?.version ?? null,
        shortName: path?.dataset ?? null,
        uploadedAt: first.uploadedAt,
        uploadedBy: first.uploadedBy,
        matchCount: rows.length,
        variables: rows,
    }
}

/**
 * The chart's own indicators lead the results, under their dataset like any
 * other group, so what a chart already draws reads the same as everything
 * else. A dataset that also matches the search keeps its own count, and its
 * other indicators follow the chosen ones — also when the search pages
 * through one dataset, where the chosen ones may sit on a later page.
 */
function withChosenFirst(
    found: DatasetSearchGroup[],
    chosen: VariableListItem[]
): DatasetSearchGroup[] {
    if (chosen.length === 0) return found

    const chosenIds = new Set(chosen.map((variable) => variable.id))
    const others = found.map((group) => ({
        ...group,
        variables: group.variables.filter(
            (variable) => !chosenIds.has(variable.id)
        ),
    }))

    const chosenByDataset = groupByDataset(chosen)
    const leading = [...chosenByDataset].map(
        ([datasetId, variables]): DatasetSearchGroup => {
            const fromSearch = others.find((group) => group.id === datasetId)
            return {
                ...groupFromRows(datasetId, variables),
                ...fromSearch,
                variables: [...variables, ...(fromSearch?.variables ?? [])],
                pinned: datasetId < 0 || !fromSearch,
            }
        }
    )
    return [
        // Datasets the search didn't match first: they hold only the ticked
        // rows, while a matching one can hold a whole page that would bury them
        ...leading.filter((group) => group.pinned),
        ...leading.filter((group) => !group.pinned),
        ...others.filter((group) => !chosenByDataset.has(group.id)),
    ]
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
    const [hasTyped, setHasTyped] = useState(false)
    const [debouncedSearch] = useDebounceValue(searchValue, 250)
    const [page, setPage] = useState(1)

    // In the order the chart draws them. The editor only opens once the
    // chart's config has loaded, so the slot is populated by now.
    const [chosen, setChosen] = useState<VariableListItem[]>(() =>
        slot.dimensions.map((dimension) => ({
            id: dimension.variableId,
            name: dimension.column.name,
            datasetName: dimension.column.datasetName,
        }))
    )

    // The slot knows its indicators' ids and names and little else. Looking
    // them up gives their datasets, which is where the picker opens.
    const initialIds = useMemo(
        () => slot.dimensions.map((dimension) => dimension.variableId),
        [slot]
    )
    const lookup = useQuery({
        queryKey: ["variable-selector-current", initialIds],
        queryFn: () =>
            admin.getJSONInBackground<{ variables: VariableListItem[] }>(
                "/api/variables.json",
                { ids: initialIds.join(",") }
            ),
        enabled: initialIds.length > 0,
    })
    const chartVariables = lookup.data?.variables

    const chosenRows = useMemo(() => {
        const rows = new Map(chartVariables?.map((row) => [row.id, row]))
        return chosen.map((variable) => rows.get(variable.id) ?? variable)
    }, [chosen, chartVariables])

    // 57% of charts with several indicators take them all from one dataset,
    // so that is where the next one is likeliest to come from. A chart already
    // spanning several gets no seed: 92% of those cross a namespace boundary
    // too, so any guess would hide more than it found.
    const chartDatasets = new Set(
        chartVariables?.map(
            (variable) =>
                variable.catalogPath &&
                parseCatalogPath(variable.catalogPath).dataset
        )
    )
    const seed =
        chartDatasets.size === 1 && [...chartDatasets][0]
            ? `dataset:${[...chartDatasets][0]}`
            : ""

    // The seed until the first keystroke, so it never fights what is typed —
    // and until the debounce has caught up with that keystroke, or the list
    // would flash every dataset in between.
    const effectiveSearch =
        !hasTyped || (debouncedSearch === "" && searchValue !== "")
            ? seed
            : debouncedSearch
    const isGrouped = !namesOneDataset(effectiveSearch)
    // The seed is only known once the lookup is back, whichever way it went
    const isSeedSettled =
        hasTyped || initialIds.length === 0 || lookup.isFetched

    // The chart's own datasets are ranked first when they match, so a broad
    // word doesn't push them past page one. Only its original ones: a dataset
    // ticked since is shown first anyway, and re-querying on every tick would
    // reorder the list under the cursor.
    const pinnedDatasetIds = useMemo(
        () =>
            [
                ...new Set(
                    chartVariables
                        ?.map((variable) => variable.datasetId)
                        .filter((id) => id !== undefined)
                ),
            ].join(","),
        [chartVariables]
    )

    const grouped = useQuery({
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
                regexError?: string
            }>("/api/variables.json", {
                search: effectiveSearch,
                group: "dataset",
                limit: DATASETS_PER_PAGE,
                offset: (page - 1) * DATASETS_PER_PAGE,
                pinnedDatasetIds,
            }),
        enabled: isGrouped && isSeedSettled,
        placeholderData: keepPreviousData,
    })

    const flat = useQuery({
        queryKey: ["variable-selector-flat", effectiveSearch, page],
        queryFn: () =>
            admin.getJSONInBackground<{
                variables: VariableListItem[]
                numTotalRows: number
                regexError?: string
            }>("/api/variables.json", {
                search: effectiveSearch,
                limit: INDICATORS_PER_PAGE,
                offset: (page - 1) * INDICATORS_PER_PAGE,
            }),
        enabled: !isGrouped && isSeedSettled,
        placeholderData: keepPreviousData,
    })

    // Naming a dataset pages through its indicators rather than capping them
    // at five, but they still read as a dataset: the same header, with the
    // page's rows under it.
    const groups = useMemo(() => {
        if (isGrouped)
            return withChosenFirst(grouped.data?.datasets ?? [], chosenRows)
        const byDataset = groupByDataset(flat.data?.variables ?? [])
        const onPage = [...byDataset].map(([datasetId, rows]) => ({
            ...groupFromRows(datasetId, rows),
            // the server counts each dataset's matches in the same pass
            matchCount: rows[0].datasetMatchCount ?? rows.length,
            paged: true,
        }))
        return withChosenFirst(onPage, chosenRows)
    }, [isGrouped, grouped.data, flat.data, chosenRows])

    const searchWords = useMemo(
        () => searchWordsToHighlight(effectiveSearch, INDICATOR_SEARCH_FIELDS),
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

    const onSearch = (value: string): void => {
        setHasTyped(true)
        setSearchValue(value)
        setPage(1)
    }

    const regexError = (isGrouped ? grouped.data : flat.data)?.regexError

    const pager = isGrouped
        ? {
              unit: "datasets",
              pageSize: DATASETS_PER_PAGE,
              total: grouped.data?.numTotalDatasets ?? 0,
          }
        : {
              unit: "indicators",
              pageSize: INDICATORS_PER_PAGE,
              total: flat.data?.numTotalRows ?? 0,
          }

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
                        loading={
                            isGrouped ? grouped.isFetching : flat.isFetching
                        }
                        selection={selection}
                        notice={
                            regexError && (
                                <Alert
                                    type="warning"
                                    showIcon
                                    className="VariableSelector__notice"
                                    title={
                                        <>
                                            MySQL couldn't run this as a regular
                                            expression: {regexError}
                                        </>
                                    }
                                />
                            )
                        }
                        search={{
                            value: hasTyped ? searchValue : seed,
                            onChange: onSearch,
                            placeholder:
                                "Search indicators, e.g. namespace:who deaths",
                            autoFocus: true,
                            width: 420,
                            fields: INDICATOR_SEARCH_FIELDS,
                            // the picker's search lives in the modal only
                            inUrl: false,
                        }}
                        footer={
                            <Pagination
                                className="VariableSelector__paging"
                                hideOnSinglePage
                                current={page}
                                pageSize={pager.pageSize}
                                total={pager.total}
                                showSizeChanger={false}
                                onChange={setPage}
                                showTotal={(total, [from, to]) =>
                                    `${pager.unit} ${from}-${to} of ${total}`
                                }
                            />
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
