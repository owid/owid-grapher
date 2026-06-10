import cx from "classnames"
import { Autocomplete } from "./search/Autocomplete.js"

export const SiteSearchNavigation = ({
    isActive,
    onClose,
    onActivate,
    isPreviewing,
}: {
    isActive: boolean
    onClose: VoidFunction
    onActivate: VoidFunction
    isPreviewing?: boolean
}) => {
    return (
        <div className={cx("SiteSearchNavigation", { active: isActive })}>
            <Autocomplete
                onActivate={onActivate}
                onClose={onClose}
                placeholder="Search for a topic, chart or article..."
                isPreviewing={isPreviewing}
            />
        </div>
    )
}
