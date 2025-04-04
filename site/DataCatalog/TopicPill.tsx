import { faClose } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { CatalogFilter, CatalogFilterType } from "./DataCatalogState.js"

export interface TopicPillProps {
    name: string
    onRemove?: (filter: CatalogFilter) => void
}

export const TopicPill = ({ name, onRemove }: TopicPillProps) => {
    return (
        /* TODO: button */
        <span
            className={"data-catalog-applied-filters-button body-3-medium"}
            onClick={() =>
                onRemove
                    ? onRemove({ type: CatalogFilterType.TOPIC, name })
                    : undefined
            }
        >
            {name}
            {onRemove && <FontAwesomeIcon icon={faClose} />}
        </span>
    )
}
