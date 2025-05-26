import * as React from "react"
import Select, { OptionProps, Props } from "react-select"
import cx from "classnames"

export interface BasicDropdownOption {
    trackNote?: string
}

export function Dropdown<DropdownOption extends BasicDropdownOption>(
    props: Props<DropdownOption, false>
): React.ReactElement {
    // Bringing our own Option component is necessary to add the data-track-note
    // attribute that is used for tracking clicks in Grapher
    const TrackedOption = (
        optionProps: OptionProps<DropdownOption, false>
    ): React.ReactElement => {
        return (
            <div
                ref={optionProps.innerRef}
                {...optionProps.innerProps}
                className={cx("option", {
                    focus: optionProps.isFocused,
                    active: optionProps.isSelected,
                })}
                data-track-note={optionProps.data.trackNote}
            >
                {optionProps.children}
            </div>
        )
    }
    return (
        <Select<DropdownOption, false>
            menuPlacement="bottom"
            components={{
                IndicatorSeparator: null,
                DropdownIndicator: null,
                Option: TrackedOption,
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
                menu: () => "menu",
                placeholder: () => "placeholder",
                clearIndicator: () => "clear-indicator",
            }}
            {...props}
            className={cx("grapher-dropdown", props.className)}
        />
    )
}
