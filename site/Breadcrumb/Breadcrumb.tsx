import React from "react"
import { BreadcrumbItem } from "@ourworldindata/utils"
import { SubNavId } from "@ourworldindata/types"
import { getSubnavItem, SubnavItem, subnavs } from "../SiteSubnavigation.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faAngleRight } from "@fortawesome/free-solid-svg-icons"

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
    subnavCurrentId: string | undefined,
    subnavItems: SubnavItem[]
): BreadcrumbItem[] | undefined => {
    const breadcrumb = []
    let currentItem = getSubnavItem(subnavCurrentId, subnavItems)
    if (!currentItem) return
    breadcrumb.push(currentItem)

    while (currentItem && currentItem.parentId) {
        currentItem = getSubnavParent(currentItem, subnavItems)
        if (currentItem) breadcrumb.push(currentItem)
    }
    if (currentItem !== subnavItems[0]) breadcrumb.push(subnavItems[0]) // add topic as parent
    return breadcrumb.reverse()
}

export const BreadcrumbsFromSubnav = ({
    subnavId,
    subnavCurrentId,
}: {
    subnavId?: SubNavId
    subnavCurrentId?: string
}) => {
    const breadcrumbItems = subnavId
        ? getBreadcrumbItems(subnavCurrentId, subnavs[subnavId])
        : null

    return breadcrumbItems ? (
        <Breadcrumbs items={breadcrumbItems} className="breadcrumb" />
    ) : null
}

const BreadcrumbSeparator = () => (
    <span className="separator">
        <FontAwesomeIcon icon={faAngleRight} />
    </span>
)

export const Breadcrumbs = ({
    items,
    className,
}: {
    items: BreadcrumbItem[]
    className: string
}) => (
    <div className={className}>
        <a href="/">Home</a>
        <BreadcrumbSeparator />
        {items.map((item, idx) => {
            const isLast = idx === items.length - 1

            const breadcrumb =
                !isLast && item.href ? (
                    <a href={item.href} data-track-note="breadcrumb">
                        {item.label}
                    </a>
                ) : (
                    <span>{item.label}</span>
                )

            return (
                <React.Fragment key={item.label}>
                    {breadcrumb}
                    {!isLast && <BreadcrumbSeparator />}
                </React.Fragment>
            )
        })}
    </div>
)
