import * as React from "react"
import classnames from "classnames"

import { defaultTo } from "grapher/utils/Util"
import { SortOrder } from "grapher/core/GrapherConstants"

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
