import * as React from "react"
import Select, { Props } from "react-select"
import cx from "classnames"

export function Dropdown<DropdownOption>(
    props: Props<DropdownOption, false>
): React.ReactElement {
    return (
        <Select<DropdownOption, false>
            menuPlacement="bottom"
            components={{
                IndicatorSeparator: null,
                DropdownIndicator: null,
            }}
            isSearchable={false}
            unstyled={true}
            isMulti={false}
            classNames={{
                control: (state) => {
                    return cx("control", {
                        focus: state.isFocused,
                        active: state.menuIsOpen,
                        "has-value": state.hasValue,
                    })
                },
                option: (state) => {
                    return cx("option", {
                        focus: state.isFocused,
                        active: state.isSelected,
                    })
                },
                menu: () => "menu",
                placeholder: () => "placeholder",
                clearIndicator: () => "clear-indicator",
            }}
            {...props}
            className={cx("grapher-dropdown", props.className)}
        />
    )
}
