import React from "react"
import Select, { Props } from "react-select"

export function Dropdown(props: Props): React.JSX.Element {
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
                control: (state) =>
                    state.menuIsOpen ? "active control" : "control",
                option: (state) =>
                    state.isSelected ? "active option" : "option",
                menu: () => "menu",
            }}
            {...props}
        />
    )
}
