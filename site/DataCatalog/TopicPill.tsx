import { faClose } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import cx from "classnames"

export interface TopicPillProps {
    name: string
    onRemove?: (name: string) => void
    className?: string
}

export const TopicPill = ({ name, onRemove, className }: TopicPillProps) => {
    return (
        <div className={cx("data-catalog-applied-filters-item", className)}>
            <div
                className={cx(
                    "data-catalog-applied-filters-button body-3-medium",
                    {
                        "with-remove-button": !!onRemove,
                    }
                )}
            >
                {name}
                {onRemove && (
                    <button
                        aria-label={`Remove filter ${name}`}
                        onClick={() => onRemove(name)}
                    >
                        <FontAwesomeIcon icon={faClose} />
                    </button>
                )}
            </div>
        </div>
    )
}
