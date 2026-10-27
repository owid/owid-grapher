import * as React from "react"
import { useState } from "react"
import { Button, Flex, Input, Popover, Space, Table, TableProps } from "antd"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCircleQuestion } from "@fortawesome/free-solid-svg-icons"
import type { SearchFieldHelp } from "../adminShared/searchFilter.js"

const ADMIN_TABLE_PAGE_SIZE = 50

export interface AdminTableSearch {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    autoFocus?: boolean
    /** Width of the search input. Defaults to 500px. */
    width?: number | string
    /** `field:value` terms the page understands, listed in a help popover. */
    fields?: readonly SearchFieldHelp[]
}

const OPERATOR_HINT: Record<SearchFieldHelp["type"], string> = {
    string: "text",
    number: "number, or >, >=, <, <=",
    boolean: "true / false",
    date: "date prefix, or >, >=, <, <=",
}

/**
 * The `?` next to a search box, listing its `field:value` terms. Exported for
 * the lists that keep their own search box rather than `AdminTable`'s.
 */
export function SearchHelp({
    fields,
}: {
    fields: readonly SearchFieldHelp[]
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

interface AdminTableToolbarProps {
    /** Search box on the left of the toolbar. */
    search?: AdminTableSearch
    /** Extra filter controls rendered next to the search box. */
    filters?: React.ReactNode
    /** Buttons rendered on the right-hand side. */
    actions?: React.ReactNode
}

/** The strip above the table: search box, syntax help, filters, buttons. */
function AdminTableToolbar({
    search,
    filters,
    actions,
}: AdminTableToolbarProps): React.ReactElement | null {
    if (!search && !filters && !actions) return null
    return (
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
                        onChange={(e) => search.onChange(e.target.value)}
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
    )
}

export interface AdminTableProps<T>
    extends TableProps<T>, AdminTableToolbarProps {
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
    const [paging, setPaging] = useState({
        current: 1,
        pageSize: ADMIN_TABLE_PAGE_SIZE,
    })
    // A new search starts from the first page — antd keeps the current one,
    // so searching from page 4 would open partway through the results
    const [lastSearch, setLastSearch] = useState(search?.value)
    if (search?.value !== lastSearch) {
        setLastSearch(search?.value)
        setPaging((paging) => ({ ...paging, current: 1 }))
    }

    return (
        <div className="AdminTable">
            <AdminTableToolbar
                search={search}
                filters={filters}
                actions={actions}
            />
            <Table<T>
                size="small"
                sticky
                rowKey="id"
                pagination={
                    pagination === false
                        ? false
                        : {
                              ...paging,
                              onChange: (current, pageSize) =>
                                  setPaging({ current, pageSize }),
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
