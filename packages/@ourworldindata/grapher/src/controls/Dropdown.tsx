import React from "react"
import Select, { Props } from "react-select"
import cx from "classnames"

export function Dropdown(props: Props): React.ReactElement {
    return (
        <Select
            className="grapher-dropdown"
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
            }}
            {...props}
        />
    )
}
