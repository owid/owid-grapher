import * as React from "react"
import { useCallback, useContext, useMemo, useState } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useDebounceValue } from "usehooks-ts"
import urljoin from "url-join"

import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext } from "./AdminAppContext.js"
import { Alert, Flex, Pagination } from "antd"
import {
    DatasetSearchGroup,
    GroupedVariableList,
    INDICATORS_PAGE_SIZE,
    VariableList,
    VariableListField,
    VariableListItem,
} from "./VariableList.js"
import {
    INDICATOR_SEARCH_FIELDS,
    namesOneDataset,
    searchWordsToHighlight,
    useSearchQueryParam,
} from "./variableSearchQuery.js"
import { ETL_WIZARD_URL } from "../settings/clientSettings.mjs"

// Readership is drawn inside "Used in", as in the grouped view, rather than in
// a column of its own
const FIELDS: VariableListField[] = ["catalogPath", "usage", "uploadedAt"]

function plural(count: number, noun: string): string {
    return `${count} ${noun}${count === 1 ? "" : "s"}`
}

function SearchSyntaxNote(): React.ReactElement {
    return (
        <p className="variables-index__help">
            Grouped by dataset — newest first, or by popularity when you search.
            Words match from their start; regular expressions work too, but are
            slow. Also try{" "}
            <a href={urljoin(ETL_WIZARD_URL, "indicator_search")}>
                semantic indicator search
            </a>
            .
        </p>
    )
}

/** Datasets per page in the grouped view; each carries up to 5 indicators. */
const DATASETS_PER_PAGE = 10

export function VariablesIndexPage(): React.ReactElement {
    const { admin } = useContext(AdminAppContext)
    const [searchValue, setSearchValue] = useSearchQueryParam()
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(INDICATORS_PAGE_SIZE)
    // A regex search over ~800k indicators takes seconds, so don't fire one
    // off on every keystroke
    const [debouncedSearch] = useDebounceValue(searchValue, 300)

    // Results come grouped by the dataset they belong to: a search matches far
    // more indicators than datasets, and browsing is most useful as the
    // datasets that changed most recently. The exception is narrowing to one
    // dataset — where a group's "more in this dataset" lands — since grouping
    // a single group would just cap it at five again.
    const isSearch = debouncedSearch.trim().length > 0
    const isGrouped = !namesOneDataset(debouncedSearch)

    const onSearchValue = useCallback(
        (value: string) => {
            setSearchValue(value)
            setPage(1)
        },
        [setSearchValue]
    )
    // For the links that narrow a search ("more in this dataset"): a step
    // Back returns from
    const onNarrowSearch = useCallback(
        (value: string) => {
            setSearchValue(value, { push: true })
            setPage(1)
        },
        [setSearchValue]
    )

    const searchProps = {
        value: searchValue,
        onChange: onSearchValue,
        placeholder: "e.g. ^population before:2023 -wdi",
        autoFocus: true,
        fields: INDICATOR_SEARCH_FIELDS,
    }

    // The indicators table is far too large to send to the browser, so the
    // search runs in SQL and the table is handed one page at a time.
    const flat = useQuery({
        queryKey: ["variables", debouncedSearch, page, pageSize],
        queryFn: () =>
            admin.getJSONInBackground<{
                variables: VariableListItem[]
                numTotalRows: number
                unindexedTerms: string[]
                regexError?: string
            }>("/api/variables.json", {
                search: debouncedSearch,
                limit: pageSize,
                offset: (page - 1) * pageSize,
            }),
        placeholderData: keepPreviousData,
        enabled: !isGrouped,
    })

    const grouped = useQuery({
        queryKey: ["variables-grouped", debouncedSearch, page],
        queryFn: () =>
            admin.getJSONInBackground<{
                datasets: DatasetSearchGroup[]
                numTotalDatasets: number
                numTotalRows: number
                unindexedTerms: string[]
                regexError?: string
            }>("/api/variables.json", {
                search: debouncedSearch,
                group: "dataset",
                limit: DATASETS_PER_PAGE,
                offset: (page - 1) * DATASETS_PER_PAGE,
            }),
        placeholderData: keepPreviousData,
        enabled: isGrouped,
    })

    const searchWords = useMemo(
        () => searchWordsToHighlight(debouncedSearch, INDICATOR_SEARCH_FIELDS),
        [debouncedSearch]
    )

    // Only ever from a settled search, so it does not blink in and out while
    // a word is half-typed
    const settled = isGrouped ? grouped.data : flat.data
    const unindexedTerms = settled?.unindexedTerms ?? []
    const regexError = settled?.regexError

    const notice = regexError ? (
        <Alert
            className="variables-index__notice"
            type="warning"
            showIcon
            title={
                <>
                    MySQL couldn't run this as a regular expression:{" "}
                    {regexError}
                </>
            }
        />
    ) : unindexedTerms.length > 0 ? (
        <Alert
            className="variables-index__notice"
            type="info"
            showIcon
            title={
                <>
                    {unindexedTerms.map((term) => `"${term}"`).join(", ")} can't
                    use the search index — too short, a very common word, or a
                    regular expression — so it's matched by reading every
                    indicator the rest of the search leaves, which can take a
                    few seconds. Another specific word usually narrows it.
                </>
            }
        />
    ) : null

    return (
        <AdminLayout title="Indicators">
            <main className="VariablesIndexPage">
                <SearchSyntaxNote />
                {isGrouped ? (
                    <GroupedVariableList
                        groups={grouped.data?.datasets ?? []}
                        isSearch={isSearch}
                        searchWords={searchWords}
                        searchValue={debouncedSearch}
                        onSearchValue={onNarrowSearch}
                        loading={grouped.isFetching}
                        search={searchProps}
                        notice={notice}
                        footer={
                            <Flex
                                className="variables-index__pager"
                                justify="space-between"
                                align="center"
                                gap="middle"
                                wrap
                            >
                                <span className="variables-index__pager-total">
                                    {(
                                        grouped.data?.numTotalRows ?? 0
                                    ).toLocaleString()}{" "}
                                    indicators in{" "}
                                    {plural(
                                        grouped.data?.numTotalDatasets ?? 0,
                                        "dataset"
                                    )}
                                </span>
                                <Pagination
                                    current={page}
                                    pageSize={DATASETS_PER_PAGE}
                                    total={grouped.data?.numTotalDatasets ?? 0}
                                    showSizeChanger={false}
                                    onChange={setPage}
                                    showTotal={(total, [from, to]) =>
                                        `datasets ${from}-${to} of ${total}`
                                    }
                                />
                            </Flex>
                        }
                    />
                ) : (
                    <VariableList
                        variables={flat.data?.variables ?? []}
                        fields={FIELDS}
                        searchWords={searchWords}
                        loading={flat.isFetching}
                        sortable={false}
                        search={searchProps}
                        notice={notice}
                        pagination={{
                            current: page,
                            pageSize,
                            total: flat.data?.numTotalRows ?? 0,
                            onChange: (nextPage, nextPageSize) => {
                                setPage(nextPage)
                                setPageSize(nextPageSize)
                            },
                        }}
                    />
                )}
            </main>
        </AdminLayout>
    )
}
