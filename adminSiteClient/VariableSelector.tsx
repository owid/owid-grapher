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
import {
    SEARCH_DEBOUNCE_MS,
    searchWordsToHighlight,
} from "./variableSearchQuery.js"
import {
    CatalogIndicator,
    columnKey,
    columnOfDimension,
    IndicatorCatalog,
    IndicatorSearchPage,
    PickedColumn,
} from "./editorProviders.js"

type SelectedColumn = Pick<CatalogIndicator, "column" | "name" | "datasetName">

function selectedFromDimension(dimension: ChartDimension): SelectedColumn {
    return {
        column: columnOfDimension(dimension),
        name: dimension.column.name,
        datasetName: dimension.column.datasetName,
    }
}

interface CatalogSearch {
    /** The latest search's page, or the one before while it runs */
    page?: IndicatorSearchPage
    isLoading: boolean
    hasFailed: boolean
}

interface Answer {
    request: string
    /** The latest page that came back, which a failure doesn't replace */
    page?: IndicatorSearchPage
    hasFailed: boolean
}

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
                if (isCurrent)
                    setAnswer({ request, page: result, hasFailed: false })
            },
            (error: unknown) => {
                console.error(error)
                if (isCurrent)
                    setAnswer((previous) => ({
                        request,
                        page: previous?.page,
                        hasFailed: true,
                    }))
            }
        )
        return () => {
            isCurrent = false
        }
    }, [catalog, query, page, request])

    const isLoading = answer?.request !== request
    return {
        page: answer?.page,
        isLoading,
        hasFailed: !isLoading && answer.hasFailed,
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
    const [debouncedSearch] = useDebounceValue(searchValue, SEARCH_DEBOUNCE_MS)
    // A page belongs to the search it was paged in, so a new one starts at 1
    const [paging, setPaging] = useState({ search: debouncedSearch, page: 1 })
    const page = paging.search === debouncedSearch ? paging.page : 1

    const search = useCatalogSearch(catalog, debouncedSearch, page)

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
            onToggle: toggle,
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
                    <Button onClick={onDismiss}>Cancel</Button>
                    <Button
                        type="primary"
                        onClick={() =>
                            onComplete(selected.map((entry) => entry.column))
                        }
                    >
                        Set indicator{s}
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
                    {search.hasFailed ? (
                        <Alert
                            type="error"
                            showIcon
                            title="The search failed. Try again in a moment."
                        />
                    ) : (
                        <>
                            {search.page && !search.isLoading && (
                                <VariableSearchNotice
                                    regexError={search.page.regexError}
                                    unindexedTerms={search.page.unindexedTerms}
                                />
                            )}
                            <div className="VariableSelector__results">
                                <GroupedVariableList<CatalogIndicator>
                                    groups={search.page?.datasets ?? []}
                                    isSearch={debouncedSearch.trim() !== ""}
                                    searchWords={searchWords}
                                    searchValue={debouncedSearch}
                                    loading={search.isLoading}
                                    selection={selection}
                                    pagination={
                                        search.page && {
                                            current: page,
                                            pageSize: search.page.pageSize,
                                            total: search.page.total,
                                            hideOnSinglePage: true,
                                            showSizeChanger: false,
                                            showTotal: (total, [from, to]) =>
                                                `${from}-${to} of ${total} ${search.page?.unit}`,
                                            onChange: (nextPage) =>
                                                setPaging({
                                                    search: debouncedSearch,
                                                    page: nextPage,
                                                }),
                                        }
                                    }
                                />
                            </div>
                        </>
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
