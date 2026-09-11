import * as React from "react"
import { Flex, Input, Space, Table, TableProps } from "antd"
import { ADMIN_TABLE_PAGE_SIZE } from "./adminTableHelpers.js"

export interface AdminTableSearch {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    autoFocus?: boolean
    /** Width of the search input. Defaults to 500px. */
    width?: number | string
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
