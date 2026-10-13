import * as React from "react"
import { useCallback, useContext, useMemo, useState } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useDebounceValue } from "usehooks-ts"
import urljoin from "url-join"

import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext } from "./AdminAppContext.js"
import { Alert, Button, Flex } from "antd"
import {
    GroupedVariableList,
    INDICATORS_PAGE_SIZE,
    VariableList,
    VariableListField,
} from "./VariableList.js"
import { VariableSearchToolbar } from "./VariableSearchToolbar.js"
import {
    INDICATOR_SEARCH_FIELDS,
    VariablesGroupedSearchResult,
    VariablesSearchResult,
} from "../adminShared/variableSearch.js"
import {
    fieldedTerms,
    namesOneDataset,
    plural,
    searchWordsToHighlight,
    useSearchQueryParam,
    withoutTerms,
} from "./variableSearchQuery.js"
import { ETL_WIZARD_URL } from "../settings/clientSettings.mjs"

// Readership is drawn inside "Used in", as in the grouped view, rather than in
// a column of its own
const FIELDS: VariableListField[] = ["catalogPath", "usage", "uploadedAt"]

function SearchSyntaxNote(): React.ReactElement {
    return (
        <div>
            Grouped by dataset — newest first, or by popularity when you search.
            Words match from their start; regular expressions work too, but are
            slow. Also try{" "}
            <a href={urljoin(ETL_WIZARD_URL, "indicator_search")}>
                semantic indicator search
            </a>
            .
        </div>
    )
}

/**
 * A `field:value` term matches exactly and silently, so a search that mixes
 * one with free text can come back empty without saying which half is to
 * blame — `namespace:climate civil` finds nothing because "civil" lives in
 * `democracy`. Says how much the search finds without its fielded terms, and
 * offers to drop them.
 */
function EmptySearchHint({
    searchValue,
    onSearchValue,
}: {
    searchValue: string
    onSearchValue: (value: string) => void
}): React.ReactElement | null {
    const { admin } = useContext(AdminAppContext)

    const fielded = useMemo(() => fieldedTerms(searchValue), [searchValue])
    const widened = useMemo(
        () => withoutTerms(searchValue, fielded),
        [searchValue, fielded]
    )

    const { data } = useQuery({
        queryKey: ["variable-search-widened", widened],
        queryFn: () =>
            admin.getJSONInBackground<VariablesGroupedSearchResult>(
                "/api/variables.json",
                {
                    search: widened,
                    group: "dataset",
                    limit: 1,
                    offset: 0,
                }
            ),
        enabled: fielded.length > 0 && widened.length > 0,
    })

    if (fielded.length === 0 || !data?.numTotalRows) return null

    return (
        <Alert
            type="info"
            showIcon
            title={
                <>
                    Nothing matches{" "}
                    {fielded.map((term) => (
                        <React.Fragment key={term}>
                            <code>{term}</code>{" "}
                        </React.Fragment>
                    ))}
                    — <b>{plural(data.numTotalRows, "indicator")}</b> in{" "}
                    {plural(data.numTotalDatasets, "dataset")} match the rest of
                    the search.
                </>
            }
            action={
                <Button size="small" onClick={() => onSearchValue(widened)}>
                    Search for {`“${widened}”`}
                </Button>
            }
        />
    )
}

/** Datasets per page in the grouped view; each carries up to 5 indicators. */
const DATASETS_PER_PAGE = 10

export function VariablesIndexPage(): React.ReactElement {
    const { admin } = useContext(AdminAppContext)
    const [searchValue, setSearchValue] = useSearchQueryParam()
    // Kept with the search it belongs to, so a new search starts on page 1,
    // typed or followed from a link, while Back to the search being paged
    // returns to its page
    const [paging, setPaging] = useState({ search: searchValue, page: 1 })
    const page = paging.search === searchValue ? paging.page : 1
    const setPage = (nextPage: number): void =>
        setPaging({ search: searchValue, page: nextPage })
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

    // For the buttons that narrow a search: a step Back returns from
    const onNarrowSearch = useCallback(
        (value: string) => setSearchValue(value, { push: true }),
        [setSearchValue]
    )

    const searchProps = {
        value: searchValue,
        onChange: setSearchValue,
        placeholder: "e.g. ^population before:2023 -wdi",
        autoFocus: true,
        fields: INDICATOR_SEARCH_FIELDS,
        isInUrl: true,
    }

    // The indicators table is far too large to send to the browser, so the
    // search runs in SQL and the table is handed one page at a time.
    const flat = useQuery({
        queryKey: ["variables", debouncedSearch, page, pageSize],
        queryFn: () =>
            admin.getJSONInBackground<VariablesSearchResult>(
                "/api/variables.json",
                {
                    search: debouncedSearch,
                    limit: pageSize,
                    offset: (page - 1) * pageSize,
                }
            ),
        placeholderData: keepPreviousData,
        enabled: !isGrouped,
    })

    const grouped = useQuery({
        queryKey: ["variables-grouped", debouncedSearch, page],
        queryFn: () =>
            admin.getJSONInBackground<VariablesGroupedSearchResult>(
                "/api/variables.json",
                {
                    search: debouncedSearch,
                    group: "dataset",
                    limit: DATASETS_PER_PAGE,
                    offset: (page - 1) * DATASETS_PER_PAGE,
                }
            ),
        placeholderData: keepPreviousData,
        enabled: isGrouped,
    })

    const searchWords = useMemo(
        () => searchWordsToHighlight(debouncedSearch),
        [debouncedSearch]
    )

    // Only ever from a settled search, so it does not blink in and out while
    // a word is half-typed
    const settled = isGrouped ? grouped.data : flat.data
    const unindexedTerms = settled?.unindexedTerms ?? []
    const regexError = settled?.regexError

    const notice = regexError ? (
        <Alert
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
                <Flex vertical gap="middle">
                    <SearchSyntaxNote />
                    {/* outside the lists, so switching between them doesn't
                    remount the box being typed in */}
                    <VariableSearchToolbar search={searchProps} />
                    {notice}
                    {isGrouped ? (
                        <GroupedVariableList
                            groups={grouped.data?.datasets ?? []}
                            isSearch={isSearch}
                            searchWords={searchWords}
                            searchValue={debouncedSearch}
                            emptyHint={
                                <EmptySearchHint
                                    searchValue={debouncedSearch}
                                    onSearchValue={onNarrowSearch}
                                />
                            }
                            loading={grouped.isFetching}
                            pagination={{
                                current: page,
                                pageSize: DATASETS_PER_PAGE,
                                total: grouped.data?.numTotalDatasets ?? 0,
                                showSizeChanger: false,
                                onChange: setPage,
                                showTotal: (total) =>
                                    `${(
                                        grouped.data?.numTotalRows ?? 0
                                    ).toLocaleString()} indicators in ${plural(
                                        total,
                                        "dataset"
                                    )}`,
                            }}
                        />
                    ) : (
                        <VariableList
                            variables={flat.data?.variables ?? []}
                            fields={FIELDS}
                            searchWords={searchWords}
                            loading={flat.isFetching}
                            sortable={false}
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
                </Flex>
            </main>
        </AdminLayout>
    )
}
