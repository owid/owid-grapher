import cx from "classnames"
import { RadioButton, RadioField, RadioGroup } from "react-aria-components"

export interface SwitcherItem<Key extends string = string> {
    key: Key
    element: React.ReactNode
    ariaLabel?: string
}

export function Switcher<Key extends string = string>({
    items,
    selectedKey,
    onChange,
    className,
    isDisabled,
    "aria-label": ariaLabel,
}: {
    items: SwitcherItem<Key>[]
    selectedKey: Key
    onChange: (key: Key) => void
    className?: string
    isDisabled?: boolean
    "aria-label"?: string
}): React.ReactElement {
    return (
        <RadioGroup
            className={cx("switcher", className)}
            aria-label={ariaLabel}
            value={selectedKey}
            onChange={(value) => {
                if (typeof value === "string") onChange(value as Key)
            }}
            orientation="horizontal"
            isDisabled={isDisabled}
        >
            {items.map((item) => (
                <RadioField
                    key={item.key}
                    value={item.key}
                    aria-label={item.ariaLabel}
                    className="switcher__item"
                >
                    <RadioButton className="switcher__button">
                        {item.element}
                    </RadioButton>
                </RadioField>
            ))}
        </RadioGroup>
    )
}
