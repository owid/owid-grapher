import React from "react"
import classnames from "classnames"

import { IconDefinition } from "@fortawesome/fontawesome-svg-core"
import { faSortAlphaUpAlt } from "@fortawesome/free-solid-svg-icons/faSortAlphaUpAlt"
import { faSortAlphaDown } from "@fortawesome/free-solid-svg-icons/faSortAlphaDown"
import { faSortAmountUpAlt } from "@fortawesome/free-solid-svg-icons/faSortAmountUpAlt"
import { faSortAmountDown } from "@fortawesome/free-solid-svg-icons/faSortAmountDown"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

import { defaultTo } from "grapher/utils/Util"
import { SortOrder } from "grapher/core/GrapherConstants"

export function SortIcon(props: {
    type?: "text" | "numeric"
    isActiveIcon?: boolean
    order: SortOrder
}) {
    const type = defaultTo(props.type, "numeric")
    const isActiveIcon = defaultTo(props.isActiveIcon, false)

    let faIcon: IconDefinition

    if (type === "text") {
        faIcon =
            props.order === SortOrder.desc ? faSortAlphaUpAlt : faSortAlphaDown
    } else {
        faIcon =
            props.order === SortOrder.desc
                ? faSortAmountDown
                : faSortAmountUpAlt
    }

    return (
        <span
            className={classnames({ "sort-icon": true, active: isActiveIcon })}
        >
            <FontAwesomeIcon icon={faIcon} />
        </span>
    )
}
