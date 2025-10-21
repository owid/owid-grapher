import cx from "classnames"
import * as React from "react"
import { useMemo } from "react"
import {
    Button,
    Input,
    Key,
    ListBox,
    ListBoxItem,
    ListBoxSection,
    Popover,
    Header,
    SelectValue,
    Select,
    Autocomplete,
    SearchField,
    useFilter,
} from "react-aria-components"
import { faTimesCircle } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
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
    onInputChange,
    placeholder,
    isDisabled,
    inputValue,
    renderMenuOption,
    ...otherProps
}: SearchDropdownProps<DropdownOption>): React.ReactElement {
    const { contains } = useFilter({ sensitivity: "base" })
    const flatOptions = useMemo(() => flattenOptions(options), [options])

    function handleSelectionChange(key: Key | null): void {
        if (key === null) {
            onChange?.(null)
            return
        }
        if (typeof key === "number") return
        const selected = flatOptions.find((option) => option.value === key)
        if (selected) {
            onChange?.(selected)
        }
    }

    return (
        <Select
            className={cx(
                "grapher-dropdown grapher-search-dropdown",
                className
            )}
            selectedKey={value?.value}
            onSelectionChange={handleSelectionChange}
            isDisabled={isDisabled}
            placeholder={placeholder}
            {...otherProps}
        >
            <Button className="control">
                <SelectValue className="select-value" />
            </Button>
            <Popover className="grapher-dropdown-menu" offset={4}>
                {/* If inputValue is provided, the component is controlled and
                we expect the filtering to happen outside of it. */}
                <Autocomplete filter={inputValue ? undefined : contains}>
                    <SearchField
                        className="grapher-dropdown-search"
                        aria-label="Search"
                        autoFocus
                    >
                        <span className="grapher-dropdown-search-icon" />
                        <Input
                            className="grapher-dropdown-search-input"
                            style={{
                                fontSize: isTouchDevice() ? 16 : undefined,
                            }}
                            value={inputValue}
                            onChange={(event) =>
                                onInputChange?.(event.target.value)
                            }
                        />
                        <Button className="grapher-dropdown-search-reset">
                            <FontAwesomeIcon icon={faTimesCircle} aria-hidden />
                        </Button>
                    </SearchField>
                    <ListBox className="grapher-dropdown-search-options">
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
                </Autocomplete>
            </Popover>
        </Select>
    )
}
