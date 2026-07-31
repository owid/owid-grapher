import cx from "classnames"

export const LabeledSwitch = ({
    value,
    onToggle,
    leftLabel,
    rightLabel,
}: {
    value?: boolean
    onToggle: () => void
    leftLabel?: string
    rightLabel?: string
}) => {
    return (
        <div className="labeled-switch">
            {leftLabel && (
                <span
                    className={cx("labeled-switch__label", {
                        "labeled-switch__label--active": !value,
                    })}
                    onClick={onToggle}
                >
                    {leftLabel}
                </span>
            )}
            <label className="labeled-switch__toggle">
                <input
                    type="checkbox"
                    checked={value}
                    onChange={onToggle}
                    className="labeled-switch__input"
                />
                <div className="labeled-switch__track">
                    <div className="labeled-switch__thumb" />
                </div>
            </label>
            {rightLabel && (
                <span
                    className={cx("labeled-switch__label", {
                        "labeled-switch__label--active": value,
                    })}
                    onClick={onToggle}
                >
                    {rightLabel}
                </span>
            )}
        </div>
    )
}
