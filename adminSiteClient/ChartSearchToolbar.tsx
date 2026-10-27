import * as React from "react"
import { useDeferredValue, useMemo, useRef, useState } from "react"
import * as _ from "lodash-es"
import { AutoComplete, Button, Input, Select } from "antd"
import {
    CHART_SEARCH_FIELDS,
    ChartSearchFacet,
    getFacetValues,
    hasChartFilters,
    IS_VALUES,
    NameCount,
    setFacetValues,
    suggestChartSearchTerms,
} from "./chartSearchQuery.js"
import { SearchHelp } from "./SearchHelp.js"

const SUGGESTION_VALUE_PREFIX = "\u0000suggestion:"

interface ChartSearchToolbarProps {
    query: string
    onQueryChange: (query: string) => void
    tags: readonly NameCount[]
    authors: readonly NameCount[]
    autoFocus?: boolean
}

function isOptions(
    facet: "status" | "source"
): { value: string; label: string }[] {
    return Object.entries(IS_VALUES)
        .filter(([, value]) => value.facet === facet)
        .map(([name, value]) => ({ value: name, label: value.label }))
}

interface NameOption {
    value: string
    label: string
    count: number
}

function nameOptions(names: readonly NameCount[]): NameOption[] {
    return names.map(({ name, count }) => ({ value: name, label: name, count }))
}

function renderNameOption(option: { data: NameOption }): React.ReactNode {
    return <NameWithCount name={option.data.label} count={option.data.count} />
}

function NameWithCount({
    name,
    count,
}: {
    name: string
    count?: number
}): React.ReactElement {
    return (
        <span className="chart-search__option">
            <span className="chart-search__name">{name}</span>
            {count !== undefined && (
                <span className="chart-search__count">
                    {count.toLocaleString()}
                </span>
            )}
        </span>
    )
}

function canonicalValues(
    values: string[],
    names: readonly NameCount[]
): string[] {
    const byLowerName = new Map(
        names.map(({ name }) => [name.toLowerCase(), name])
    )
    return _.uniq(
        values.map((value) => byLowerName.get(value.toLowerCase()) ?? value)
    )
}

function NameFilter({
    placeholder,
    names,
    values,
    onChange,
}: {
    placeholder: string
    names: readonly NameCount[]
    values: string[]
    onChange: (values: string[]) => void
}): React.ReactElement {
    const options = useMemo(() => nameOptions(names), [names])
    return (
        <Select
            className="chart-search__filter chart-search__filter--names"
            mode="multiple"
            placeholder={placeholder}
            allowClear
            maxTagCount={1}
            showSearch={{ optionFilterProp: "value" }}
            value={canonicalValues(values, names)}
            options={options}
            optionRender={renderNameOption}
            onChange={onChange}
            popupMatchSelectWidth={280}
        />
    )
}

export function ChartSearchToolbar({
    query,
    onQueryChange,
    tags,
    authors,
    autoFocus,
}: ChartSearchToolbarProps): React.ReactElement {
    const [typedQuery, setTypedQuery] = useState<string | undefined>()
    const deferredQuery = useDeferredValue(query)
    const suggestions = useMemo(
        () =>
            deferredQuery === typedQuery
                ? suggestChartSearchTerms(deferredQuery, { tags, authors })
                : [],
        [deferredQuery, typedQuery, tags, authors]
    )
    // An option's value is its index, not the query it leads to: the select
    // highlights an option whose value begins with what was typed, so `is:dr`
    // would preselect `is:draft` (and Enter take it) but `ener` not preselect
    // `tag:Energy`. With nothing preselected, Enter only ever takes a
    // suggestion picked with the arrow keys.
    const suggestionOptions = useMemo(
        () =>
            Object.entries(
                _.groupBy(
                    suggestions.map((suggestion, index) => ({
                        suggestion,
                        value: `${SUGGESTION_VALUE_PREFIX}${index}`,
                    })),
                    ({ suggestion }) => suggestion.group
                )
            ).map(([group, options]) => ({
                label: group,
                options: options.map(({ suggestion, value }) => ({
                    value,
                    label: (
                        <NameWithCount
                            name={suggestion.label}
                            count={suggestion.count}
                        />
                    ),
                })),
            })),
        [suggestions]
    )
    // Picking a field (`author:`) closes the list like any pick, but what
    // comes next is choosing its value, so the list opens again for that
    const [isOpen, setIsOpen] = useState(false)
    const keepOpen = useRef(false)
    const onOpenChange = (open: boolean): void => {
        if (!open && keepOpen.current) {
            keepOpen.current = false
            return
        }
        setIsOpen(open)
    }

    const onInputChange = (value: string): void => {
        if (!value.startsWith(SUGGESTION_VALUE_PREFIX)) {
            setTypedQuery(value)
            return onQueryChange(value)
        }
        const index = Number(value.slice(SUGGESTION_VALUE_PREFIX.length))
        const suggestion = suggestions[index]
        if (!suggestion) return
        onQueryChange(suggestion.resultingQuery)
        if (suggestion.expectsValue) {
            setTypedQuery(suggestion.resultingQuery)
            keepOpen.current = true
            setIsOpen(true)
        } else setTypedQuery(undefined)
    }

    const setFacet = (
        facet: ChartSearchFacet,
        values: readonly string[]
    ): void => onQueryChange(setFacetValues(query, facet, values))
    const setSingleFacet = (
        facet: ChartSearchFacet,
        value: string | undefined
    ): void => setFacet(facet, value ? [value] : [])

    return (
        <div className="chart-search">
            <div className="chart-search__box">
                <AutoComplete
                    className="chart-search__input"
                    value={query}
                    options={suggestionOptions}
                    onChange={onInputChange}
                    open={isOpen && suggestions.length > 0}
                    onOpenChange={onOpenChange}
                    defaultActiveFirstOption={false}
                    popupMatchSelectWidth={500}
                >
                    <Input
                        placeholder="Search, or filter: tag:Energy is:draft author:…"
                        allowClear
                        autoFocus={autoFocus}
                    />
                </AutoComplete>
                <SearchHelp
                    intro={
                        <>
                            Words are combined with AND and are looked for in
                            the title, variant, notes, slug, id, chart type,
                            tags and people. Use <code>"a phrase"</code> to keep
                            words together and <code>-word</code> to exclude;
                            both work for filters too (<code>-is:draft</code>).
                            Repeat a filter to match any of its values:{" "}
                            <code>tag:Energy tag:Health</code>. The filters next
                            to the box write these terms for you, and the whole
                            search is kept in the page URL.
                        </>
                    }
                    fields={CHART_SEARCH_FIELDS}
                />
            </div>
            <div className="chart-search__filters">
                <Select
                    className="chart-search__filter"
                    placeholder="Status"
                    allowClear
                    value={getFacetValues(query, "status")[0]}
                    options={isOptions("status")}
                    onChange={(value?: string) =>
                        setSingleFacet("status", value)
                    }
                />
                <Select
                    className="chart-search__filter chart-search__filter--wide"
                    placeholder="Source"
                    allowClear
                    value={getFacetValues(query, "source")[0]}
                    options={isOptions("source")}
                    onChange={(value?: string) =>
                        setSingleFacet("source", value)
                    }
                    popupMatchSelectWidth={false}
                />
                <NameFilter
                    placeholder="Tags"
                    names={tags}
                    values={getFacetValues(query, "tag")}
                    onChange={(values) => setFacet("tag", values)}
                />
                <NameFilter
                    placeholder="Authors"
                    names={authors}
                    values={getFacetValues(query, "author")}
                    onChange={(values) => setFacet("author", values)}
                />
                {hasChartFilters(query) && (
                    <Button type="link" onClick={() => onQueryChange("")}>
                        Clear all
                    </Button>
                )}
            </div>
        </div>
    )
}
