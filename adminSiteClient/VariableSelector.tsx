import * as React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Alert, Checkbox, ConfigProvider, Flex, Typography } from "antd"
import { useDebounceValue } from "usehooks-ts"
import { excludeUndefined } from "@ourworldindata/utils"
import {
    IndicatorDimensionInterface,
    SlugDimensionInterface,
} from "@ourworldindata/types"
import { ChartDimension, DimensionSlot } from "@ourworldindata/grapher"

import { Modal } from "./Forms.js"
import { GroupedVariableList, IndicatorSelection } from "./VariableList.js"
import { VariableSearchToolbar } from "./VariableSearchToolbar.js"
import { searchWordsToHighlight } from "./variableSearchQuery.js"
import {
    CatalogIndicator,
    IndicatorCatalog,
    IndicatorSearchPage,
} from "./editorProviders.js"

export type PickedColumn =
    | Pick<IndicatorDimensionInterface, "variableId" | "slug">
    | Pick<SlugDimensionInterface, "slug" | "variableId">

interface ChosenColumn {
    column: PickedColumn
    name: string
    datasetName?: string
}

function columnKey(column: PickedColumn): string {
    return column.slug !== undefined
        ? `slug:${column.slug}`
        : `id:${column.variableId}`
}

function chosenFromIndicator(indicator: CatalogIndicator): ChosenColumn {
    return {
        column:
            indicator.slug !== undefined
                ? { slug: indicator.slug }
                : { variableId: indicator.id },
        name: indicator.name,
        datasetName: indicator.datasetName,
    }
}

function chosenFromDimension(dimension: ChartDimension): ChosenColumn {
    return {
        column:
            dimension.variableId !== undefined
                ? { variableId: dimension.variableId }
                : { slug: dimension.columnSlug },
        name: dimension.column.name,
        datasetName: dimension.column.datasetName,
    }
}

type SearchState =
    | { status: "loading"; previous?: IndicatorSearchPage }
    | { status: "done"; page: IndicatorSearchPage }
    | { status: "failed"; message: string }

type Answer = { catalog: IndicatorCatalog; request: string } & (
    | { page: IndicatorSearchPage }
    | { failure: string }
)

/** The latest search's page, keeping the one before on screen while it runs */
function useCatalogSearch(
    catalog: IndicatorCatalog,
    query: string,
    page: number
): SearchState {
    const request = JSON.stringify([query, page])
    const [answer, setAnswer] = useState<Answer>()
    useEffect(() => {
        let isCurrent = true
        catalog.search(query, page).then(
            (result) => {
                if (isCurrent) setAnswer({ catalog, request, page: result })
            },
            (error: unknown) => {
                if (isCurrent)
                    setAnswer({
                        catalog,
                        request,
                        failure:
                            error instanceof Error
                                ? error.message
                                : String(error),
                    })
            }
        )
        return () => {
            isCurrent = false
        }
    }, [catalog, query, page, request])

    if (answer?.catalog === catalog && answer.request === request)
        return "page" in answer
            ? { status: "done", page: answer.page }
            : { status: "failed", message: answer.failure }
    return {
        status: "loading",
        previous: answer && "page" in answer ? answer.page : undefined,
    }
}

interface VariableSelectorProps {
    catalog: IndicatorCatalog
    slot: DimensionSlot
    onDismiss: () => void
    onComplete: (columns: PickedColumn[]) => void
}

/** Picks the indicators for a dimension slot from the store's catalog */
export function VariableSelector({
    catalog,
    slot,
    onDismiss,
    onComplete,
}: VariableSelectorProps): React.ReactElement {
    const [chosen, setChosen] = useState<ChosenColumn[]>(() =>
        slot.dimensions.map(chosenFromDimension)
    )
    const [searchValue, setSearchValue] = useState(() =>
        catalog.initialQuery(
            excludeUndefined(
                slot.dimensions.map((dimension) => dimension.column.datasetId)
            )
        )
    )
    const [debouncedSearch] = useDebounceValue(searchValue, 250)
    // A page belongs to the search it was paged in, so a new one starts at 1
    const [paging, setPaging] = useState({ search: debouncedSearch, page: 1 })
    const page = paging.search === debouncedSearch ? paging.page : 1

    const search = useCatalogSearch(catalog, debouncedSearch, page)
    const shown =
        search.status === "done"
            ? search.page
            : search.status === "loading"
              ? search.previous
              : undefined

    const chosenKeys = useMemo(
        () => new Set(chosen.map((entry) => columnKey(entry.column))),
        [chosen]
    )
    const toggle = useCallback(
        (entry: ChosenColumn) =>
            setChosen((existing) => {
                const key = columnKey(entry.column)
                if (existing.some((other) => columnKey(other.column) === key))
                    return existing.filter(
                        (other) => columnKey(other.column) !== key
                    )
                // a slot that takes one indicator swaps rather than adds
                return slot.allowMultiple ? [...existing, entry] : [entry]
            }),
        [slot.allowMultiple]
    )
    const selection: IndicatorSelection<CatalogIndicator> = useMemo(
        () => ({
            isSelected: (indicator) =>
                chosenKeys.has(
                    columnKey(chosenFromIndicator(indicator).column)
                ),
            onToggle: (indicator) => toggle(chosenFromIndicator(indicator)),
        }),
        [chosenKeys, toggle]
    )

    const searchWords = useMemo(
        () => searchWordsToHighlight(debouncedSearch),
        [debouncedSearch]
    )

    // Popovers inside the modal rather than at the end of the page, where
    // they open behind it and a click in one would read as a click outside
    const containerRef = useRef<HTMLDivElement>(null)
    const getPopupContainer = useCallback(
        () => containerRef.current ?? document.body,
        []
    )

    const s = slot.allowMultiple ? "s" : ""

    return (
        <Modal onClose={onDismiss} className="VariableSelector">
            <div
                ref={containerRef}
                onKeyDown={(event) => {
                    if (event.key === "Escape") onDismiss()
                }}
            >
                <ConfigProvider getPopupContainer={getPopupContainer}>
                    <div className="modal-header">
                        <h5 className="modal-title">
                            Set indicator{s} for {slot.name}
                        </h5>
                    </div>
                    <div className="modal-body VariableSelector__body">
                        <Flex
                            vertical
                            gap="small"
                            className="VariableSelector__results"
                        >
                            <VariableSearchToolbar
                                search={{
                                    value: searchValue,
                                    onChange: setSearchValue,
                                    placeholder: "Search indicators...",
                                    autoFocus: true,
                                    fields: catalog.fields,
                                }}
                            />
                            {search.status === "failed" && (
                                <Alert
                                    type="error"
                                    showIcon
                                    title={`The search failed: ${search.message}`}
                                />
                            )}
                            {shown?.error && (
                                <Alert
                                    type="warning"
                                    showIcon
                                    title={`This search couldn't run as typed: ${shown.error}`}
                                />
                            )}
                            {search.status !== "failed" && (
                                <GroupedVariableList<CatalogIndicator>
                                    groups={shown?.datasets ?? []}
                                    isSearch={debouncedSearch.trim() !== ""}
                                    searchWords={searchWords}
                                    searchValue={debouncedSearch}
                                    loading={search.status === "loading"}
                                    selection={selection}
                                    onNarrow={setSearchValue}
                                    pagination={
                                        shown && {
                                            current: page,
                                            pageSize: shown.pageSize,
                                            total: shown.total,
                                            hideOnSinglePage: true,
                                            showSizeChanger: false,
                                            showTotal: (total, [from, to]) =>
                                                `${from}-${to} of ${total} ${shown.unit}`,
                                            onChange: (nextPage) =>
                                                setPaging({
                                                    search: debouncedSearch,
                                                    page: nextPage,
                                                }),
                                        }
                                    }
                                />
                            )}
                        </Flex>
                        <div className="VariableSelector__chosen">
                            <Typography.Text strong>
                                Selected indicator{s}
                            </Typography.Text>
                            {chosen.length === 0 && (
                                <Typography.Paragraph type="secondary">
                                    None yet
                                </Typography.Paragraph>
                            )}
                            {chosen.map((entry) => (
                                <div
                                    key={columnKey(entry.column)}
                                    className="VariableSelector__chosen-item"
                                >
                                    <Checkbox
                                        checked
                                        onChange={() => toggle(entry)}
                                    >
                                        {entry.name}
                                        {entry.datasetName && (
                                            <Typography.Text type="secondary">
                                                {" "}
                                                {entry.datasetName}
                                            </Typography.Text>
                                        )}
                                    </Checkbox>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button className="btn" onClick={onDismiss}>
                            Close
                        </button>
                        <button
                            className="btn btn-success"
                            onClick={() =>
                                onComplete(chosen.map((entry) => entry.column))
                            }
                        >
                            Set variable{s}
                        </button>
                    </div>
                </ConfigProvider>
            </div>
        </Modal>
    )
}
