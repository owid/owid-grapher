import * as React from "react"
import classnames from "classnames"

import { defaultTo } from "charts/Util"

import { SortOrder } from "./CovidTypes"

export interface CovidTableSortIconProps {
    sortOrder: SortOrder
    isActive: boolean
}

export const CovidTableSortIcon = (props: CovidTableSortIconProps) => {
    const isActive = defaultTo(props.isActive, false)

    return (
        <span
            className={classnames("sort-icon", props.sortOrder, {
                active: isActive
            })}
        />
    )
}
