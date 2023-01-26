import React, { useCallback, useEffect } from "react"
import Autocomplete from "@mui/material/Autocomplete"
import TextField from "@mui/material/TextField"
import { uniqBy } from "@ourworldindata/utils"
import { countries as fullCountries } from "@ourworldindata/utils"
import {
    Hits,
    useSearchBox,
    UseSearchBoxProps,
} from "react-instantsearch-hooks-web"
import { TopicCard } from "./TopicCard.js"

interface Facet {
    label: string
    type: FacetType
}

enum FacetType {
    Tag = "tag",
    Author = "author",
    Country = "country",
}

export const SearchAutocomplete = (props: UseSearchBoxProps) => {
    const [tags, setTags] = React.useState<Facet[]>([])
    const [countries, setCountries] = React.useState<Facet[]>([])
    const [value, setValue] = React.useState<Facet[]>([])
    const [inputValue, setInputValue] = React.useState("")

    const queryHook: UseSearchBoxProps["queryHook"] = useCallback(
        (query, search) => {
            search(query, { tagFilters: "Energy" })
            console.log("queryHook", query)
        },
        []
    )

    const { query, refine, clear, isSearchStalled } = useSearchBox({
        ...props,
        // useCallback
        queryHook,
    })

    // Fetch and process facets
    useEffect(() => {
        const fetchTags = async () => {
            const response = await fetch("/api/tags.json")
            const data = await response.json()

            const tags = uniqBy(
                data.tags.map((tag: { name: string }): Facet => {
                    return { label: tag.name, type: FacetType.Tag }
                }),
                (t: Facet) => t.label
            )

            setTags(tags)
        }
        fetchTags()
    }, [])

    // Fetch and process countries
    useEffect(() => {
        setCountries(
            fullCountries.map((c) => ({
                label: c.name,
                type: FacetType.Country,
            }))
        )
    }, [])

    const refineCallback = useCallback(refine, [refine])
    useEffect(() => {
        refineCallback(value.map((v) => v.label).join(","))
    }, [refineCallback, value])

    return (
        <>
            <div>{`value: ${
                value !== null ? `'${value.join(",")}'` : "null"
            }`}</div>
            <div>{`inputValue: '${inputValue}'`}</div>
            <Autocomplete
                multiple
                options={[...tags, ...countries]}
                groupBy={(option) => option.type}
                getOptionLabel={(option) => option.label}
                filterSelectedOptions
                renderInput={(params) => (
                    <TextField
                        {...params}
                        label="filterSelectedOptions"
                        placeholder="Favorites"
                    />
                )}
                value={value}
                onChange={(event: any, newValue: Facet[]) => {
                    setValue(newValue)
                }}
                inputValue={inputValue}
                onInputChange={(event, newInputValue) => {
                    setInputValue(newInputValue)
                }}
            />
            <Hits hitComponent={TopicCard}></Hits>
        </>
    )
}
