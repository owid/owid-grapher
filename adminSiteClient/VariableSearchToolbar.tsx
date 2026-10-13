import * as React from "react"
import { Alert, Button, Input, Popover, Space } from "antd"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCircleQuestion } from "@fortawesome/free-solid-svg-icons"
import type { SearchFieldHelp } from "../adminShared/variableSearch.js"
import type { VariableSearchBox } from "./variableSearchQuery.js"

function SearchHelp({
    fields,
}: {
    fields: readonly SearchFieldHelp[]
}): React.ReactElement {
    return (
        <Popover
            title="Search syntax"
            placement="bottomLeft"
            content={
                <div className="variable-list__search-help">
                    <p>
                        Words are combined with AND and match from the start of
                        a word. Use <code>"a phrase"</code> to keep words
                        together and <code>-word</code> to exclude. Regular
                        expressions work too, but read every indicator, so they
                        are slow.
                    </p>
                    <table>
                        <tbody>
                            {fields.map((field) => (
                                <tr key={field.name}>
                                    <td>
                                        <code>{field.name}:</code>
                                    </td>
                                    <td>{field.description}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            }
        >
            <Button
                type="text"
                aria-label="Search syntax"
                icon={<FontAwesomeIcon icon={faCircleQuestion} />}
            />
        </Popover>
    )
}

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
                <SearchHelp fields={search.fields} />
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
