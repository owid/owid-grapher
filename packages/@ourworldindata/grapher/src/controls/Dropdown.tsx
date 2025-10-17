import cx from "classnames"
import * as React from "react"
import { useMemo } from "react"
import {
    Button,
    ListBox,
    ListBoxItem,
    ListBoxSection,
    Popover,
    Header,
    Select,
    SelectValue,
    Key,
} from "react-aria-components"

export interface BasicDropdownOption {
    trackNote?: string
    value: string
    label: React.ReactNode
}

export interface DropdownOptionGroup<
    DropdownOption extends BasicDropdownOption,
> {
    label: React.ReactNode
    options: DropdownOption[]
}

export type DropdownCollectionItem<DropdownOption extends BasicDropdownOption> =
    DropdownOption | DropdownOptionGroup<DropdownOption>

export type DropdownCollection<DropdownOption extends BasicDropdownOption> =
    DropdownCollectionItem<DropdownOption>[]

export interface DropdownProps<DropdownOption extends BasicDropdownOption> {
    className?: string
    menuClassName?: string
    options: DropdownCollection<DropdownOption>
    value?: DropdownOption | null
    onChange?: (option: DropdownOption | null) => void
    placeholder?: string
    isDisabled?: boolean
    isClearable?: boolean
    isLoading?: boolean
    renderTriggerValue?: (
        option: DropdownOption | null
    ) => React.ReactNode | undefined
    renderMenuOption?: (option: DropdownOption) => React.ReactNode
    portalContainer?: HTMLElement
    "data-track-note"?: string
    "aria-label"?: string
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

export function Dropdown<DropdownOption extends BasicDropdownOption>({
    className,
    // We use a separate prop for the menu's className because the Popover
    // (menu) doesn't render as a child of the select, so it's not trivial to
    // style it using the main className.
    menuClassName,
    options,
    value,
    onChange,
    placeholder,
    isDisabled,
    isClearable,
    isLoading,
    renderTriggerValue,
    renderMenuOption,
    portalContainer,
    ...otherProps
}: DropdownProps<DropdownOption>): React.ReactElement {
    const flatOptions = useMemo(() => flattenOptions(options), [options])
    const selectedValue = value ?? null

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
            className={cx("grapher-dropdown", className)}
            // null means no selection, undefined means the component is
            // uncontrolled, so we need to set it explicitly.
            selectedKey={value?.value ?? null}
            onSelectionChange={handleSelectionChange}
            isDisabled={isDisabled}
            {...otherProps}
        >
            <Button
                className={cx("control", {
                    loading: isLoading,
                })}
            >
                <SelectValue className="select-value">
                    {() => {
                        const rendered = renderTriggerValue?.(selectedValue)
                        if (rendered !== undefined) return rendered
                        if (selectedValue)
                            return selectedValue.label as React.ReactNode
                        if (placeholder)
                            return (
                                <span className="placeholder">
                                    {placeholder}
                                </span>
                            )
                        return null
                    }}
                </SelectValue>
            </Button>
            {isClearable && value && (
                <Button
                    className="clear-indicator"
                    slot={null}
                    type="button"
                    onPress={() => onChange?.(null)}
                    aria-label="Clear selection"
                />
            )}
            <Popover
                className={cx("grapher-dropdown-menu", menuClassName)}
                offset={4}
                UNSTABLE_portalContainer={portalContainer}
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
        </Select>
    )
}
