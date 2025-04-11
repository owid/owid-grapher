import * as React from "react"
import { Props } from "react-select"
import { Dropdown } from "./Dropdown.js"

export function SearchDropdown<DropdownOption>(
    props: Props<DropdownOption, false>
): React.ReactElement {
    return (
        <Dropdown
            className="grapher-search-dropdown"
            isClearable={true}
            noOptionsMessage={() => null}
            // prevent auto-zoom on ios
            styles={{ input: (provided) => ({ ...provided, fontSize: 16 }) }}
            {...props}
        />
    )
}
