import * as React from "react"
import { useContext, useMemo, useState } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useDebounceValue } from "usehooks-ts"
import urljoin from "url-join"

import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext } from "./AdminAppContext.js"
import { VariableList, VariableListItem } from "./VariableList.js"
import {
    ADMIN_TABLE_PAGE_SIZE,
    highlightSearchWords,
    useSearchQueryParam,
} from "./adminTableHelpers.js"
import { ETL_WIZARD_URL } from "../settings/clientSettings.mjs"

const FIELDS = [
    "namespace",
    "version",
    "dataset",
    "table",
    "shortName",
    "uploadedAt",
] as const

function SearchSyntaxHelp(): React.ReactElement {
    return (
        <div className="variables-index__help">
            <p>
                <em>
                    You can use regular expressions and the following fields:
                </em>{" "}
                <code>name:</code>, <code>path:</code>, <code>namespace:</code>,{" "}
                <code>version:</code>, <code>dataset:</code>,{" "}
                <code>table:</code>, <code>short:</code>, <code>before:</code>,{" "}
                <code>after:</code>, <code>is:public</code>,{" "}
                <code>is:private</code>
            </p>
            <p>
                Also try:{" "}
                <a href={urljoin(ETL_WIZARD_URL, "indicator_search")}>
                    semantic indicator search
                </a>
            </p>
        </div>
    )
}

export function VariablesIndexPage(): React.ReactElement {
    const { admin } = useContext(AdminAppContext)
    const [searchValue, setSearchValue] = useSearchQueryParam()
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(ADMIN_TABLE_PAGE_SIZE)
    // A regex search over ~800k indicators takes seconds, so don't fire one
    // off on every keystroke
    const [debouncedSearch] = useDebounceValue(searchValue, 300)

    // The indicators table is far too large to send to the browser, so the
    // search runs in SQL and the table is handed one page at a time.
    const { data, isFetching } = useQuery({
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
    })

    const highlight = useMemo(
        // Fielded and regex searches don't map onto plain word highlighting,
        // so only highlight when the query is neither.
        () =>
            /[:^$*+?()[\]{}|\\]/.test(debouncedSearch)
                ? undefined
                : highlightSearchWords(debouncedSearch),
        [debouncedSearch]
    )

    return (
        <AdminLayout title="Indicators">
            <main className="VariablesIndexPage">
                <SearchSyntaxHelp />
                <VariableList
                    variables={data?.variables ?? []}
                    fields={[...FIELDS]}
                    searchHighlight={highlight}
                    loading={isFetching}
                    sortable={false}
                    search={{
                        value: searchValue,
                        onChange: (value) => {
                            setSearchValue(value)
                            setPage(1)
                        },
                        placeholder: "e.g. ^population before:2023 -wdi",
                        autoFocus: true,
                    }}
                    pagination={{
                        current: page,
                        pageSize,
                        total: data?.numTotalRows ?? 0,
                        onChange: (nextPage, nextPageSize) => {
                            setPage(nextPage)
                            setPageSize(nextPageSize)
                        },
                    }}
                />
            </main>
        </AdminLayout>
    )
}
