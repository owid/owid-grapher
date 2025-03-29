import { faClose } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import cx from "classnames"

export interface CountryPillProps {
    name: string
    code: string
    onRemove?: (name: string) => void
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
        >
            <img
                width={20}
                height={16}
                src={`/images/flags/${code}.svg`}
                alt={`${name} flag`}
            />
            <span className="body-3-medium">{name}</span>
            {onRemove && (
                <button
                    aria-label={`Remove ${name}`}
                    onClick={() => onRemove(name)}
                >
                    <FontAwesomeIcon icon={faClose} />
                </button>
            )}
        </div>
    )
}
