import * as React from "react"
import { bind } from "decko"
import classnames from "classnames"

import { SortOrder } from "charts/DataTableTransform"

import { CovidAccessorKey } from "./CovidTypes"
import { CovidTableSortIcon } from "./CovidTableSortIcon"
import { DEFAULT_SORT_ORDER } from "./CovidConstants"

export interface CovidHeaderCellProps {
    children: React.ReactNode
    className?: string
    sortKey?: CovidAccessorKey
    currentSortKey?: CovidAccessorKey
    currentSortOrder?: SortOrder
    isSorted?: boolean
    colSpan?: number
    onSort?: (key: CovidAccessorKey) => void
}

export class CovidHeaderCell extends React.Component<CovidHeaderCellProps> {
    @bind onClick() {
        if (this.props.sortKey && this.props.onSort) {
            this.props.onSort(this.props.sortKey)
        }
    }

    render() {
        const {
            className,
            sortKey,
            currentSortKey,
            currentSortOrder,
            children,
            colSpan
        } = this.props
        const isSorted = sortKey !== undefined && sortKey === currentSortKey
        return (
            <th
                className={classnames(className, {
                    sortable: sortKey,
                    sorted: isSorted
                })}
                onClick={this.onClick}
                colSpan={colSpan}
            >
                {children}
                {sortKey !== undefined && (
                    <CovidTableSortIcon
                        sortOrder={
                            isSorted && currentSortOrder
                                ? currentSortOrder
                                : DEFAULT_SORT_ORDER
                        }
                        isActive={isSorted}
                    />
                )}
            </th>
        )
    }
}
