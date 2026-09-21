import { faChevronUp } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

interface MetadataBoxCollapseButtonProps {
    detailsRef: React.RefObject<HTMLDetailsElement | null>
}

export function MetadataBoxCollapseButton({
    detailsRef,
}: MetadataBoxCollapseButtonProps): React.ReactElement {
    return (
        <button
            type="button"
            className="metadata-box-collapse-button"
            onClick={() => {
                if (detailsRef.current) detailsRef.current.open = false
            }}
        >
            Show less
            <FontAwesomeIcon
                icon={faChevronUp}
                className="metadata-box-collapse-button__chevron"
            />
        </button>
    )
}
