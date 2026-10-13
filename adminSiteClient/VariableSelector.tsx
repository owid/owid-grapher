import * as React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Alert, Button, Checkbox, Flex, Modal, Typography } from "antd"
import { useDebounceValue } from "usehooks-ts"
import { excludeUndefined } from "@ourworldindata/utils"
import { ChartDimension, DimensionSlot } from "@ourworldindata/grapher"

import { GroupedVariableList, IndicatorSelection } from "./VariableList.js"
import {
    VariableSearchNotice,
    VariableSearchToolbar,
} from "./VariableSearchToolbar.js"
import { searchWordsToHighlight } from "./variableSearchQuery.js"
import {
    CatalogIndicator,
    IndicatorCatalog,
    IndicatorSearchPage,
    PickedColumn,
} from "./editorProviders.js"

interface SelectedColumn {
    column: PickedColumn
    name: string
    datasetName?: string
}

function columnKey(column: PickedColumn): string {
    return column.slug !== undefined
        ? `slug:${column.slug}`
        : `id:${column.variableId}`
}

function selectedFromIndicator(indicator: CatalogIndicator): SelectedColumn {
    return {
        column: indicator.column,
        name: indicator.name,
        datasetName: indicator.datasetName,
    }
}

function selectedFromDimension(dimension: ChartDimension): SelectedColumn {
    return {
        column:
            dimension.variableId !== undefined
                ? { variableId: dimension.variableId }
                : { slug: dimension.columnSlug },
        name: dimension.column.name,
        datasetName: dimension.column.datasetName,
    }
}

interface CatalogSearch {
    /** The latest search's page, or the one before while it runs */
    page?: IndicatorSearchPage
    isLoading: boolean
    failure?: string
}

type Answer = { request: string } & (
    | { page: IndicatorSearchPage }
    | { failure: string }
)

// Not react-query, which the admin uses elsewhere: the editor is meant to run
// outside the admin, without its QueryClientProvider
function useCatalogSearch(
    catalog: IndicatorCatalog,
    query: string,
    page: number
): CatalogSearch {
    const request = JSON.stringify([query, page])
    const [answer, setAnswer] = useState<Answer>()
    useEffect(() => {
        let isCurrent = true
        catalog.search(query, page).then(
            (result) => {
                if (isCurrent) setAnswer({ request, page: result })
            },
            (error: unknown) => {
                if (isCurrent)
                    setAnswer({
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

    const isLoading = answer?.request !== request
    if (answer && "failure" in answer)
        return isLoading
            ? { isLoading }
            : { isLoading, failure: answer.failure }
    return { page: answer?.page, isLoading }
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
    const [selected, setSelected] = useState<SelectedColumn[]>(() =>
        slot.dimensions.map(selectedFromDimension)
    )
    const [searchValue, setSearchValue] = useState(() => {
        const initial = catalog.initialQuery(
            excludeUndefined(
                slot.dimensions.map((dimension) => dimension.column.datasetId)
            )
        )
        // so that typing straight away adds a word instead of extending it
        return initial ? `${initial} ` : ""
    })
    const [debouncedSearch] = useDebounceValue(searchValue, 250)
    // A page belongs to the search it was paged in, so a new one starts at 1
    const [paging, setPaging] = useState({ search: debouncedSearch, page: 1 })
    const page = paging.search === debouncedSearch ? paging.page : 1

    const search = useCatalogSearch(catalog, debouncedSearch, page)
    const shown = search.page

    const selectedKeys = useMemo(
        () => new Set(selected.map((entry) => columnKey(entry.column))),
        [selected]
    )
    const toggle = useCallback(
        (entry: SelectedColumn) =>
            setSelected((existing) => {
                const key = columnKey(entry.column)
                const rest = existing.filter(
                    (other) => columnKey(other.column) !== key
                )
                if (rest.length < existing.length) return rest
                // a slot that takes one indicator swaps rather than adds
                return slot.allowMultiple ? [...existing, entry] : [entry]
            }),
        [slot.allowMultiple]
    )
    const selection: IndicatorSelection<CatalogIndicator> = useMemo(
        () => ({
            isSelected: (indicator) =>
                selectedKeys.has(columnKey(indicator.column)),
            onToggle: (indicator) => toggle(selectedFromIndicator(indicator)),
            onNarrow: setSearchValue,
        }),
        [selectedKeys, toggle]
    )

    const searchWords = useMemo(
        () => searchWordsToHighlight(debouncedSearch),
        [debouncedSearch]
    )

    const s = slot.allowMultiple ? "s" : ""

    return (
        <Modal
            open
            centered
            width="min(1100px, 90vw)"
            className="VariableSelector"
            title={`Set indicator${s} for ${slot.name}`}
            onCancel={onDismiss}
            footer={
                <>
                    <Button onClick={onDismiss}>Close</Button>
                    <Button
                        type="primary"
                        onClick={() =>
                            onComplete(selected.map((entry) => entry.column))
                        }
                    >
                        Set variable{s}
                    </Button>
                </>
            }
        >
            <div className="VariableSelector__body">
                <Flex vertical gap="small" className="VariableSelector__main">
                    <VariableSearchToolbar
                        search={{
                            value: searchValue,
                            onChange: setSearchValue,
                            placeholder: "Search indicators...",
                            autoFocus: true,
                            fields: catalog.fields,
                        }}
                    />
                    {search.failure !== undefined && (
                        <Alert
                            type="error"
                            showIcon
                            title={`The search failed: ${search.failure}`}
                        />
                    )}
                    {shown && !search.isLoading && (
                        <VariableSearchNotice
                            regexError={shown.regexError}
                            unindexedTerms={shown.unindexedTerms}
                        />
                    )}
                    {search.failure === undefined && (
                        <div className="VariableSelector__results">
                            <GroupedVariableList<CatalogIndicator>
                                groups={shown?.datasets ?? []}
                                isSearch={debouncedSearch.trim() !== ""}
                                searchWords={searchWords}
                                searchValue={debouncedSearch}
                                loading={search.isLoading}
                                selection={selection}
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
                        </div>
                    )}
                </Flex>
                <div className="VariableSelector__selected">
                    <Typography.Text strong>
                        Selected indicator{s}
                    </Typography.Text>
                    {selected.length === 0 && (
                        <Typography.Paragraph type="secondary">
                            None yet
                        </Typography.Paragraph>
                    )}
                    {selected.map((entry) => (
                        <div
                            key={columnKey(entry.column)}
                            className="VariableSelector__selected-item"
                        >
                            <Checkbox checked onChange={() => toggle(entry)}>
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
        </Modal>
    )
}
