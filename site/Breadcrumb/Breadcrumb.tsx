import { Fragment } from "react"
import { BreadcrumbItem } from "@ourworldindata/utils"
import { PROD_URL } from "../SiteConstants.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faAngleRight } from "@fortawesome/free-solid-svg-icons"
import { BAKED_BASE_URL, IS_ARCHIVE } from "../../settings/clientSettings.js"

const BASE_URL = IS_ARCHIVE ? PROD_URL : BAKED_BASE_URL

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
        <a href={`${BASE_URL}/`}>Home</a>
        <BreadcrumbSeparator />
        {items.map((item, idx) => {
            const isLast = idx === items.length - 1

            const breadcrumb = item.href ? (
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
