import React from "react"
import { SubNavId } from "../../clientUtils/owidTypes"
import { SubnavItem, subnavs } from "../SiteSubnavigation"

export const getParent = (
    currentItem: SubnavItem,
    subnavItems: SubnavItem[]
) => {
    return subnavItems.find((item) => item.id === currentItem.parentId)
}

export const getAncestors = (
    subnavCurrentHref: string,
    subnavItems: SubnavItem[]
) => {
    const ancestors = []
    let currentItem = subnavItems.find(
        (item) => item.href === subnavCurrentHref
    )
    if (!currentItem) return

    while (currentItem && currentItem.parentId) {
        currentItem = getParent(currentItem, subnavItems)
        if (currentItem) ancestors.push(currentItem)
    }
    ancestors.push(subnavItems[0]) // add topic as parent
    return ancestors.reverse()
}

export const Breadcrumb = ({
    subnavId,
    subnavCurrentHref,
}: {
    subnavId: SubNavId
    subnavCurrentHref: string
}) => {
    const currentItem = subnavs[subnavId].find(
        (item) => item.href === subnavCurrentHref
    )
    const ancestors = getAncestors(subnavCurrentHref, subnavs[subnavId])
    return (
        <div className="breadcrumb">
            {ancestors &&
                ancestors.map((item) => (
                    <React.Fragment key={item.href}>
                        <a href={item.href}>{item.label}</a>
                        <span className="separator">&gt;</span>
                    </React.Fragment>
                ))}
            <span>{currentItem?.label}</span>
        </div>
    )
}
