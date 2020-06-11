import React from "react"
import classnames from "classnames"

import { IconDefinition } from "@fortawesome/fontawesome-svg-core"
import { faSortAlphaUpAlt } from "@fortawesome/free-solid-svg-icons/faSortAlphaUpAlt"
import { faSortAlphaDown } from "@fortawesome/free-solid-svg-icons/faSortAlphaDown"
import { faSortAmountUp } from "@fortawesome/free-solid-svg-icons/faSortAmountUp"
import { faSortAmountDownAlt } from "@fortawesome/free-solid-svg-icons/faSortAmountDownAlt"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

import { defaultTo } from "./Util"
import { SortOrder } from "./SortOrder"

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
                ? faSortAmountUp
                : faSortAmountDownAlt
    }

    return (
        <span
            className={classnames({ "sort-icon": true, active: isActiveIcon })}
        >
            <FontAwesomeIcon icon={faIcon} />
        </span>
    )
}
