import { faClose } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

export interface TopicPillProps {
    name: string
    onRemove?: (name: string) => void
}

export const TopicPill = ({ name, onRemove }: TopicPillProps) => {
    return (
        /* TODO: button */
        <span
            className={"data-catalog-applied-filters-button body-3-medium"}
            onClick={() => (onRemove ? onRemove(name) : undefined)}
        >
            {name}
            {onRemove && <FontAwesomeIcon icon={faClose} />}
        </span>
    )
}
