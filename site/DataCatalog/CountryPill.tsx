import { faClose } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import cx from "classnames"
import { CatalogFilter, CatalogFilterType } from "./DataCatalogState.js"

export interface CountryPillProps {
    name: string
    code: string
    onRemove?: (filter: CatalogFilter) => void
    hideOnDesktop?: boolean
    className?: string
}

export const CountryPill = ({
    name,
    code,
    onRemove,
    hideOnDesktop = false,
    className,
}: CountryPillProps) => {
    return (
        <div
            className={cx("data-catalog-selected-country-pill", className, {
                "data-catalog-selected-country-pill--hide-on-desktop":
                    hideOnDesktop,
            })}
            onClick={
                onRemove
                    ? () => onRemove({ type: CatalogFilterType.COUNTRY, name })
                    : undefined
            }
        >
            <img
                width={20}
                height={16}
                src={`/images/flags/${code}.svg`}
                alt={`${name} flag`}
            />
            <span className="data-catalog-selected-country-pill__name body-3-medium">
                {name}
            </span>
            {onRemove && (
                <span className="data-catalog-selected-country-pill__remove body-3-medium">
                    <FontAwesomeIcon icon={faClose} />
                </span>
            )}
        </div>
    )
}
