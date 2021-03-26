import React from "react"
import { SubNavId } from "../../clientUtils/owidTypes"
import { SubnavItem, subnavs } from "../SiteSubnavigation"

export const getParent = (
    currentItem: SubnavItem,
    subnavItems: SubnavItem[]
) => {
    return subnavItems.find((item) => item.id === currentItem.parentId)
}

export const getBreadcrumbItems = (
    subnavCurrentHref: string,
    subnavItems: SubnavItem[]
) => {
    const breadcrumb = []
    let currentItem = subnavItems.find(
        (item) => item.href === subnavCurrentHref
    )
    if (!currentItem) return
    breadcrumb.push(currentItem)

    while (currentItem && currentItem.parentId) {
        currentItem = getParent(currentItem, subnavItems)
        if (currentItem) breadcrumb.push(currentItem)
    }
    if (currentItem !== subnavItems[0]) breadcrumb.push(subnavItems[0]) // add topic as parent
    return breadcrumb.reverse()
}

export const Breadcrumb = ({
    subnavId,
    subnavCurrentHref,
}: {
    subnavId: SubNavId
    subnavCurrentHref: string
}) => {
    const breadcrumbItems = getBreadcrumbItems(
        subnavCurrentHref,
        subnavs[subnavId]
    )
    return (
        <span className="breadcrumb">
            {breadcrumbItems &&
                breadcrumbItems.map((item, idx) => (
                    <React.Fragment key={item.href}>
                        {item.label}
                        {idx !== breadcrumbItems.length - 1 && (
                            <span className="separator">&gt;</span>
                        )}
                    </React.Fragment>
                ))}
        </span>
    )
}
