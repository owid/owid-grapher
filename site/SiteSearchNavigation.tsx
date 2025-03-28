import cx from "classnames"
import { Autocomplete } from "./search/Autocomplete.js"

export const SiteSearchNavigation = ({
    isActive,
    onClose,
    onActivate,
}: {
    isActive: boolean
    onClose: VoidFunction
    onActivate: VoidFunction
}) => {
    return null //hack: remove site-wide autocomplete to prevent conflicts with the data catalog autocomplete
    return (
        <div className={cx("SiteSearchNavigation", { active: isActive })}>
            <Autocomplete
                onActivate={onActivate}
                onClose={onClose}
                placeholder="Search for a topic, chart or article..."
            />
        </div>
    )
}
