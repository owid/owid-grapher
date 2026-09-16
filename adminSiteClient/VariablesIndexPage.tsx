import * as React from "react"
import { useCallback, useContext, useMemo, useState } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useDebounceValue } from "usehooks-ts"
import urljoin from "url-join"

import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext } from "./AdminAppContext.js"
import { Flex, Pagination } from "antd"
import {
    DatasetSearchGroup,
    GroupedVariableList,
    VariableList,
    VariableListItem,
} from "./VariableList.js"
import {
    ADMIN_TABLE_PAGE_SIZE,
    useSearchQueryParam,
} from "./adminTableHelpers.js"
import {
    SearchFieldHelp,
    searchWordsToHighlight,
} from "../adminShared/searchFilter.js"
import { ETL_WIZARD_URL } from "../settings/clientSettings.mjs"

const FIELDS = ["catalogPath", "usage", "popularity", "uploadedAt"] as const

/**
 * Unlike the other lists, the indicators search runs in SQL (see
 * `searchVariables`), so the fields are declared rather than derived — they
 * feed the help popover and the highlighting of matched text.
 */
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
    {
        name: "datasetname",
        type: "string",
        description: "The dataset's title",
    },
    { name: "before", type: "date", description: "Version before this date" },
    { name: "after", type: "date", description: "Version after this date" },
    { name: "is", type: "string", description: "`public` or `private`" },
]

function SearchSyntaxNote(): React.ReactElement {
    return (
        <p className="variables-index__help">
            Terms are matched as regular expressions, and results are ordered by
            popularity. Also try{" "}
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
    const [pageSize, setPageSize] = useState(ADMIN_TABLE_PAGE_SIZE)
    // A regex search over ~800k indicators takes seconds, so don't fire one
    // off on every keystroke
    const [debouncedSearch] = useDebounceValue(searchValue, 300)

    // A search matches far more indicators than datasets, so it comes back
    // grouped by dataset. Browsing without one is a flat list: there is no
    // relevance to group by, and 1,224 dataset headers would only be a slower
    // table of contents. Narrowing to one dataset is flat too — that is where
    // a group's "more in this dataset" lands, and grouping a single group
    // would just cap it at five again.
    const isGrouped =
        debouncedSearch.trim().length > 0 && !/\bdataset:/.test(debouncedSearch)

    const onSearchValue = useCallback(
        (value: string) => {
            setSearchValue(value)
            setPage(1)
        },
        [setSearchValue]
    )

    const searchProps = {
        value: searchValue,
        onChange: onSearchValue,
        placeholder: "e.g. ^population before:2023 -wdi",
        autoFocus: true,
        fields: SEARCH_FIELDS,
    }

    // The indicators table is far too large to send to the browser, so the
    // search runs in SQL and the table is handed one page at a time.
    const flat = useQuery({
        queryKey: ["variables", debouncedSearch, page, pageSize],
        queryFn: () =>
            admin.getJSONInBackground<{
                variables: VariableListItem[]
                numTotalRows: number
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
        () => searchWordsToHighlight(debouncedSearch, SEARCH_FIELDS),
        [debouncedSearch]
    )

    return (
        <AdminLayout title="Indicators">
            <main className="VariablesIndexPage">
                <SearchSyntaxNote />
                {isGrouped ? (
                    <GroupedVariableList
                        groups={grouped.data?.datasets ?? []}
                        searchWords={searchWords}
                        searchValue={debouncedSearch}
                        onSearchValue={onSearchValue}
                        loading={grouped.isFetching}
                        search={searchProps}
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
                                    {grouped.data?.numTotalDatasets ?? 0}{" "}
                                    datasets
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
                        fields={[...FIELDS]}
                        searchWords={searchWords}
                        loading={flat.isFetching}
                        sortable={false}
                        search={searchProps}
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
