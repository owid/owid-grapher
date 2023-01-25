import React, { useEffect } from "react"
import Autocomplete from "@mui/material/Autocomplete"
import TextField from "@mui/material/TextField"
import { uniqBy } from "@ourworldindata/utils"
import { countries as fullCountries } from "@ourworldindata/utils"

interface Facet {
    label: string
    type: FacetType
}

enum FacetType {
    Tag = "tag",
    Author = "author",
    Country = "country",
}

export const SearchAutocomplete = () => {
    const [tags, setTags] = React.useState<Facet[]>([])
    const [countries, setCountries] = React.useState<Facet[]>([])

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

    return (
        <>
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
            />
        </>
    )
}
