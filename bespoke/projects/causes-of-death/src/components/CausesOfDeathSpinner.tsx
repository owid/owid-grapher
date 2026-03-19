import { faCircleNotch } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

export function CausesOfDeathSpinner() {
    return (
        <div className="causes-of-death-spinner">
            <FontAwesomeIcon icon={faCircleNotch} spin size="2x" />
        </div>
    )
}
