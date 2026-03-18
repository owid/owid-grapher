import { faCircleNotch } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

export function LoadingSpinner() {
    return (
        <div className="demography-spinner">
            <FontAwesomeIcon icon={faCircleNotch} spin size="2x" />
        </div>
    )
}

export function DemographyChartError() {
    return <div>Demography visualization can't be loaded</div>
}

export function DemographySkeleton() {
    return (
        <div className="demography-skeleton">
            <LoadingSpinner />
        </div>
    )
}
