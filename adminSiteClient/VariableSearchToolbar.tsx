import * as React from "react"
import { Input, Space } from "antd"
import type { VariableSearchBox } from "./variableSearchQuery.js"
import { SearchHelp } from "./SearchHelp.js"

/** The strip above the list: the search box, its help, and any filters. */
export function VariableSearchToolbar({
    search,
    filters,
}: {
    search: VariableSearchBox
    filters?: React.ReactNode
}): React.ReactElement {
    return (
        <Space size="middle" wrap>
            <Input
                placeholder={search.placeholder ?? "Search..."}
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
                style={{ width: 500 }}
                autoFocus={search.autoFocus}
                allowClear
            />
            {search.fields?.length ? (
                <SearchHelp
                    intro={
                        <>
                            Words are combined with AND and match from the start
                            of a word. Use <code>"a phrase"</code> to keep words
                            together and <code>-word</code> to exclude. Regular
                            expressions work too, but read every indicator, so
                            they are slow. The search is kept in the page URL,
                            so a filtered list can be shared.
                        </>
                    }
                    fields={search.fields}
                />
            ) : null}
            {filters}
        </Space>
    )
}
