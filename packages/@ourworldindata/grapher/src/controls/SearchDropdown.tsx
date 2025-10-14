import cx from "classnames"
import * as React from "react"
import { useMemo } from "react"
import {
    ComboBox,
    Input,
    Key,
    ListBox,
    ListBoxItem,
    ListBoxSection,
    Popover,
    Header,
} from "react-aria-components"
import { isTouchDevice } from "@ourworldindata/utils"
import {
    BasicDropdownOption,
    DropdownCollection,
    DropdownCollectionItem,
    DropdownOptionGroup,
    DropdownProps,
} from "./Dropdown.js"

interface SearchDropdownProps<DropdownOption extends BasicDropdownOption>
    extends Omit<DropdownProps<DropdownOption>, "isClearable"> {
    options: DropdownCollection<DropdownOption>
    onFocus?: () => void
    onInputChange?: (value: string) => void
    inputValue?: string
}

function isOptionGroup<DropdownOption extends BasicDropdownOption>(
    item: DropdownCollectionItem<DropdownOption>
): item is DropdownOptionGroup<DropdownOption> {
    return (item as DropdownOptionGroup<DropdownOption>).options !== undefined
}

function flattenOptions<DropdownOption extends BasicDropdownOption>(
    options: DropdownCollection<DropdownOption>
): DropdownOption[] {
    return options.flatMap((item) =>
        isOptionGroup(item) ? item.options : [item]
    )
}

export function SearchDropdown<DropdownOption extends BasicDropdownOption>({
    className,
    options,
    value,
    onChange,
    onFocus,
    onInputChange,
    placeholder,
    isDisabled,
    inputValue,
    renderMenuOption,
    ...otherProps
}: SearchDropdownProps<DropdownOption>): React.ReactElement {
    const flatOptions = useMemo(() => flattenOptions(options), [options])

    function handleSelectionChange(key: Key | null): void {
        if (key === null) {
            onChange?.(null)
            onInputChange?.("")
            return
        }
        if (typeof key === "number") return
        const selected = flatOptions.find((option) => option.value === key)
        if (selected) {
            onChange?.(selected)
            onInputChange?.("")
        }
    }

    function handleInputChange(value: string): void {
        onInputChange?.(value)
    }

    return (
        <ComboBox
            className={cx(
                "grapher-dropdown grapher-search-dropdown",
                className
            )}
            selectedKey={value?.value}
            onSelectionChange={handleSelectionChange}
            menuTrigger="focus"
            isDisabled={isDisabled}
            inputValue={inputValue}
            onInputChange={handleInputChange}
            {...otherProps}
        >
            <div className="control-wrapper">
                <Input
                    className="control"
                    placeholder={placeholder}
                    onFocus={onFocus}
                    style={{
                        fontSize: isTouchDevice() ? 16 : undefined,
                    }}
                />
                <span className="control-icon"></span>
            </div>
            <Popover
                className="grapher-dropdown-menu"
                maxHeight={400}
                offset={4}
            >
                <ListBox>
                    {options.map((item, index) =>
                        isOptionGroup(item) ? (
                            <ListBoxSection
                                key={`section-${index}`}
                                id={`section-${index}`}
                                className="group"
                            >
                                <Header className="group-heading">
                                    {item.label}
                                </Header>
                                {item.options.map((option) => (
                                    <ListBoxItem
                                        className="option"
                                        key={option.value}
                                        id={option.value}
                                        textValue={
                                            typeof option.label === "string"
                                                ? option.label
                                                : String(option.value)
                                        }
                                        data-track-note={option.trackNote}
                                    >
                                        {renderMenuOption
                                            ? renderMenuOption(option)
                                            : option.label}
                                    </ListBoxItem>
                                ))}
                            </ListBoxSection>
                        ) : (
                            <ListBoxItem
                                className="option"
                                key={item.value}
                                id={item.value}
                                textValue={
                                    typeof item.label === "string"
                                        ? item.label
                                        : String(item.value)
                                }
                                data-track-note={item.trackNote}
                            >
                                {renderMenuOption
                                    ? renderMenuOption(item)
                                    : item.label}
                            </ListBoxItem>
                        )
                    )}
                </ListBox>
            </Popover>
        </ComboBox>
    )
}
