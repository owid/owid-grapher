import * as React from "react"
import { Button, Input, Popover, Space } from "antd"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCircleQuestion } from "@fortawesome/free-solid-svg-icons"
import type {
    SearchFieldHelp,
    VariableSearchBox,
} from "./variableSearchQuery.js"

function SearchHelp({
    fields,
    inUrl,
}: {
    fields: SearchFieldHelp[]
    inUrl: boolean
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
                        {inUrl &&
                            " The search is kept in the page URL, so a filtered list can be shared."}
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
    search?: VariableSearchBox
    filters?: React.ReactNode
}): React.ReactElement | null {
    if (!search && !filters) return null
    return (
        <Space className="variable-list__toolbar" size="middle" wrap>
            {search && (
                <Input
                    placeholder={search.placeholder ?? "Search..."}
                    value={search.value}
                    onChange={(e) => search.onChange(e.target.value)}
                    style={{ width: search.width ?? 500 }}
                    autoFocus={search.autoFocus}
                    allowClear
                />
            )}
            {search?.fields?.length ? (
                <SearchHelp
                    fields={search.fields}
                    inUrl={search.inUrl ?? true}
                />
            ) : null}
            {filters}
        </Space>
    )
}
