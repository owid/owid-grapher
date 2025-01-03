import { Fragment } from "react"
import { BreadcrumbItem } from "@ourworldindata/utils"
import { SubNavId } from "@ourworldindata/types"
import { subnavs } from "../SiteConstants.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faAngleRight } from "@fortawesome/free-solid-svg-icons"
import { getBreadcrumbItems } from "./breadcrumbUtils.js"

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
                <Fragment key={item.label}>
                    {breadcrumb}
                    {!isLast && <BreadcrumbSeparator />}
                </Fragment>
            )
        })}
    </div>
)
