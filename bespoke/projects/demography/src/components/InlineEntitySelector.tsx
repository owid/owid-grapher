import { useCallback, useMemo, useState } from "react"
import {
    Autocomplete,
    Button,
    DialogTrigger,
    Header,
    Input,
    Key,
    ListBox,
    ListBoxItem,
    ListBoxSection,
    Popover,
    SearchField,
    useFilter,
} from "react-aria-components"
import { faTimesCircle } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { EntityName } from "@ourworldindata/types"

import { useUserCountryInformation } from "../../../../hooks/useUserCountryInformation.js"
import { groupByUserLocation } from "../../../../components/EntityDropdown/EntityDropdown.js"

import { DemographyMetadata } from "../helpers/types.js"
import { displayEntityName, entityNameForSentence } from "../helpers/utils.js"

interface Option {
    value: string
    label: string
}

interface OptionGroup {
    label: string
    options: Option[]
}

type OptionCollection = (Option | OptionGroup)[]

function isGroup(item: Option | OptionGroup): item is OptionGroup {
    return "options" in item
}

export function InlineEntitySelector({
    metadata,
    entityName,
    onChange,
}: {
    metadata: DemographyMetadata
    entityName: EntityName
    onChange: (entityName: EntityName) => void
}) {
    const [isOpen, setIsOpen] = useState(false)

    const handleSelect = useCallback(
        (key: Key | null) => {
            if (typeof key === "string") {
                onChange(key)
                setIsOpen(false)
            }
        },
        [onChange]
    )

    return (
        <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
            <Button className="inline-entity-selector__trigger">
                {entityNameForSentence(entityName)}
                <span className="inline-entity-selector__arrow">
                    {"\u00a0"}▾
                </span>
            </Button>
            <Popover
                className="inline-entity-selector__popover grapher-dropdown-menu"
                placement="bottom start"
                style={{ width: 240 }}
            >
                <EntityListBox
                    availableCountries={metadata.countries}
                    selectedEntityName={entityName}
                    onSelectionChange={handleSelect}
                />
            </Popover>
        </DialogTrigger>
    )
}

function EntityListBox({
    availableCountries,
    selectedEntityName,
    onSelectionChange,
}: {
    availableCountries: string[]
    selectedEntityName: EntityName
    onSelectionChange: (key: Key | null) => void
}) {
    const { data: userCountryInfo } = useUserCountryInformation()
    const { contains } = useFilter({ sensitivity: "base" })

    const options: OptionCollection = useMemo(() => {
        const flat = availableCountries.map((name) => ({
            value: name,
            label: displayEntityName(name),
        }))
        return groupByUserLocation(flat, userCountryInfo) as OptionCollection
    }, [availableCountries, userCountryInfo])

    return (
        <Autocomplete filter={contains}>
            <SearchField
                className="grapher-dropdown-search"
                aria-label="Search"
                autoFocus
            >
                <span className="grapher-dropdown-search-icon" />
                <Input
                    className="grapher-dropdown-search-input"
                    placeholder="Search..."
                />
                <Button className="grapher-dropdown-search-reset">
                    <FontAwesomeIcon icon={faTimesCircle} aria-hidden />
                </Button>
            </SearchField>
            <ListBox
                className="grapher-dropdown-listbox"
                selectedKeys={
                    selectedEntityName
                        ? new Set([selectedEntityName])
                        : new Set()
                }
                selectionMode="single"
                onSelectionChange={(keys) => {
                    const key = [...keys][0]
                    onSelectionChange(key ?? null)
                }}
            >
                {options.map((item, index) =>
                    isGroup(item) ? (
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
                                    textValue={option.label}
                                >
                                    {option.label}
                                </ListBoxItem>
                            ))}
                        </ListBoxSection>
                    ) : (
                        <ListBoxItem
                            className="option"
                            key={item.value}
                            id={item.value}
                            textValue={item.label}
                        >
                            {item.label}
                        </ListBoxItem>
                    )
                )}
            </ListBox>
        </Autocomplete>
    )
}
