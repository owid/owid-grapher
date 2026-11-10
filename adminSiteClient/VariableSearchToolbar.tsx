import * as React from "react"
import { Alert, Input, Space } from "antd"
import type { VariableSearchBox } from "./variableSearchQuery.js"
import { SearchHelp, SearchHelpTable } from "./SearchHelp.js"

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
                <SearchHelp>
                    <p>
                        Words are combined with AND and match from the start of
                        a word. Use <code>"a phrase"</code> to keep words
                        together and <code>-word</code> to exclude. Regular
                        expressions work too, but read every indicator, so they
                        are slow.
                    </p>
                    <SearchHelpTable
                        rows={search.fields.map((field) => ({
                            example: `${field.name}:`,
                            meaning: field.description,
                        }))}
                    />
                </SearchHelp>
            ) : null}
            {filters}
        </Space>
    )
}

/** Why a search returned nothing, or why it was slow */
export function VariableSearchNotice({
    regexError,
    unindexedTerms = [],
}: {
    regexError?: string
    unindexedTerms?: string[]
}): React.ReactElement | null {
    if (regexError)
        return (
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
        )
    if (unindexedTerms.length > 0)
        return (
            <Alert
                type="info"
                showIcon
                title={
                    <>
                        {unindexedTerms.map((term) => `"${term}"`).join(", ")}{" "}
                        can't use the search index — too short, a very common
                        word, or a regular expression — so it's matched by
                        reading every indicator the rest of the search leaves,
                        which can take a few seconds. Another specific word
                        usually narrows it.
                    </>
                }
            />
        )
    return null
}
