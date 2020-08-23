import * as React from "react"
import { bind } from "decko"
import classnames from "classnames"

import { SortOrder } from "charts/core/ChartConstants"
import { CovidSortKey } from "./CovidTypes"
import { CovidTableSortIcon } from "./CovidTableSortIcon"
import { DEFAULT_SORT_ORDER } from "./CovidConstants"

export interface CovidTableHeaderCellProps {
    children: React.ReactNode
    className?: string
    sortKey?: CovidSortKey
    currentSortKey?: CovidSortKey
    currentSortOrder?: SortOrder
    colSpan?: number
    onSort?: (key: CovidSortKey) => void
}

export class CovidTableHeaderCell extends React.Component<
    CovidTableHeaderCellProps
> {
    @bind onClick() {
        if (this.props.sortKey && this.props.onSort) {
            this.props.onSort(this.props.sortKey)
        }
    }

    render() {
        const {
            className,
            sortKey,
            children,
            colSpan,
            currentSortKey,
            currentSortOrder
        } = this.props

        const isSorted = sortKey !== undefined && sortKey === currentSortKey
        const order =
            isSorted && currentSortOrder ? currentSortOrder : DEFAULT_SORT_ORDER

        return (
            <th
                className={classnames(className, {
                    sortable: sortKey !== undefined,
                    sorted: isSorted
                })}
                onClick={this.onClick}
                colSpan={colSpan}
            >
                {children}
                {sortKey !== undefined && (
                    <CovidTableSortIcon sortOrder={order} isActive={isSorted} />
                )}
            </th>
        )
    }
}
