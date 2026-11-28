import { Switcher } from "../../../../components/Switcher/Switcher.js"

import { Y_SCALE_TYPES, YScaleType } from "../core/constants.js"

const LABELS: Record<YScaleType, string> = {
    log: "Log",
    linear: "Linear",
}

/** Logarithmic or linear y axis */
export function YScaleSwitch({
    yScaleType,
    onChange,
}: {
    yScaleType: YScaleType
    onChange: (type: YScaleType) => void
}) {
    return (
        <div className="y-scale-switch">
            <span className="y-scale-switch__label">Y axis</span>
            <Switcher
                ariaLabel="Y axis scale"
                items={Y_SCALE_TYPES.map((type) => ({
                    key: type,
                    element: LABELS[type],
                }))}
                selectedKey={yScaleType}
                onChange={onChange}
            />
        </div>
    )
}
