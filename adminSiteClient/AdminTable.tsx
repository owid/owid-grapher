import * as React from "react"
import { Button, Flex, Input, Popover, Space, Table, TableProps } from "antd"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCircleQuestion } from "@fortawesome/free-solid-svg-icons"
import type { SearchFieldHelp } from "../adminShared/searchFilter.js"
import { ADMIN_TABLE_PAGE_SIZE } from "./adminTableHelpers.js"

export interface AdminTableSearch {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    autoFocus?: boolean
    /** Width of the search input. Defaults to 500px. */
    width?: number | string
    /** `field:value` terms the page understands, listed in a help popover. */
    fields?: SearchFieldHelp[]
}

const OPERATOR_HINT: Record<SearchFieldHelp["type"], string> = {
    string: "text",
    number: "number, or >, >=, <, <=",
    boolean: "true / false",
    date: "date prefix, or >, >=, <, <=",
}

function SearchHelp({
    fields,
}: {
    fields: SearchFieldHelp[]
}): React.ReactElement {
    return (
        <Popover
            title="Search syntax"
            placement="bottomLeft"
            content={
                <div className="AdminTable__search-help">
                    <p>
                        Terms are combined with AND. Use <code>"a phrase"</code>{" "}
                        to match words together and <code>-term</code> to
                        exclude. The search is kept in the page URL, so a
                        filtered list can be shared.
                    </p>
                    <table>
                        <tbody>
                            {fields.map((field) => (
                                <tr key={field.name}>
                                    <td>
                                        <code>{field.name}:</code>
                                    </td>
                                    <td>{field.description}</td>
                                    <td>{OPERATOR_HINT[field.type]}</td>
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

export interface AdminTableProps<T> extends TableProps<T> {
    /** Search box rendered above the table, on the left of the toolbar. */
    search?: AdminTableSearch
    /** Extra filter controls rendered next to the search box. */
    filters?: React.ReactNode
    /** Buttons rendered on the right-hand side of the toolbar. */
    actions?: React.ReactNode
    /** Plural noun used in the pagination summary, e.g. "datasets". */
    entityName?: string
}

/**
 * The table we use for admin index pages: an antd `Table` with our defaults
 * (compact rows, sticky header, paging with a total count) plus an optional
 * toolbar holding the search box, filters and page-level actions.
 *
 * Columns and data fetching stay with the page; this only owns the chrome that
 * would otherwise be reinvented per page.
 */
export function AdminTable<T extends object>({
    search,
    filters,
    actions,
    entityName,
    pagination,
    ...tableProps
}: AdminTableProps<T>): React.ReactElement {
    const hasToolbar = !!(search || filters || actions)

    return (
        <div className="AdminTable">
            {hasToolbar && (
                <Flex
                    className="AdminTable__toolbar"
                    align="center"
                    justify="space-between"
                    gap="middle"
                    wrap
                >
                    <Space size="middle" wrap>
                        {search && (
                            <Input
                                placeholder={search.placeholder ?? "Search..."}
                                value={search.value}
                                onChange={(e) =>
                                    search.onChange(e.target.value)
                                }
                                style={{ width: search.width ?? 500 }}
                                autoFocus={search.autoFocus}
                                allowClear
                            />
                        )}
                        {search?.fields?.length ? (
                            <SearchHelp fields={search.fields} />
                        ) : null}
                        {filters}
                    </Space>
                    {actions && <Space size="small">{actions}</Space>}
                </Flex>
            )}
            <Table<T>
                size="small"
                sticky
                rowKey="id"
                pagination={
                    pagination === false
                        ? false
                        : {
                              pageSize: ADMIN_TABLE_PAGE_SIZE,
                              showSizeChanger: true,
                              showQuickJumper: true,
                              showTotal: (total, [from, to]) =>
                                  `${from}-${to} of ${total}${entityName ? ` ${entityName}` : ""}`,
                              ...pagination,
                          }
                }
                {...tableProps}
            />
        </div>
    )
}
