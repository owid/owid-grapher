import React from "react"
import { SubNavId } from "../../clientUtils/owidTypes.js"
import { getSubnavItem, SubnavItem, subnavs } from "../SiteSubnavigation.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faAngleRight } from "@fortawesome/free-solid-svg-icons/faAngleRight.js"

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
): SubnavItem[] | undefined => {
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

const BreadcrumbSeparator = () => (
    <span className="separator">
        <FontAwesomeIcon icon={faAngleRight} />
    </span>
)

export const Breadcrumb = ({
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
        <div className="breadcrumb">
            <a href="/">Home</a>
            <BreadcrumbSeparator />
            {breadcrumbItems.map((item, idx) => (
                <React.Fragment key={item.href}>
                    {idx !== breadcrumbItems.length - 1 ? (
                        <>
                            <a data-track-note="breadcrumb" href={item.href}>
                                {item.label}
                            </a>
                            <BreadcrumbSeparator />
                        </>
                    ) : (
                        <span>{item.label}</span>
                    )}
                </React.Fragment>
            ))}
        </div>
    ) : null
}
