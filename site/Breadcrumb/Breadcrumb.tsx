import React from "react"
import { SubNavId } from "../../clientUtils/owidTypes"
import { SubnavItem, subnavs } from "../SiteSubnavigation"

export const getSubnavItem = (
    href: string | undefined,
    subnavItems: SubnavItem[]
) => {
    // We want to avoid matching elements with potentially undefined href.
    // Static typing prevents href from being undefined but this might not be
    // the case in a future API powered version.
    return href ? subnavItems.find((item) => item.href === href) : undefined
}

export const getSubnavParent = (
    currentItem: SubnavItem | undefined,
    subnavItems: SubnavItem[]
) => {
    const parentId = currentItem?.parentId
    // We want to avoid matching elements with potentially undefined id.
    // Static typing prevents id from being undefined but this might not be
    // the case in a future API powered version.
    return parentId
        ? subnavItems.find((item) => item.id === parentId)
        : undefined
}

export const getBreadcrumbItems = (
    subnavCurrentHref: string,
    subnavItems: SubnavItem[]
) => {
    const breadcrumb = []
    let currentItem = getSubnavItem(subnavCurrentHref, subnavItems)
    if (!currentItem) return
    breadcrumb.push(currentItem)

    while (currentItem && currentItem.parentId) {
        currentItem = getSubnavParent(currentItem, subnavItems)
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
