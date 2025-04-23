import React from "react"
import { CatalogContentType } from "./DataCatalogState.js"
import { ToggleButton, ToggleButtonGroup, Box } from "@mui/material"

interface ContentTypeToggleProps {
    contentTypeFilter: CatalogContentType
    setContentTypeFilter: (filter: CatalogContentType) => void
}

export const DataCatalogContentTypeToggle = ({
    contentTypeFilter = CatalogContentType.ALL,
    setContentTypeFilter,
}: ContentTypeToggleProps) => {
    const handleChange = (
        _event: React.MouseEvent<HTMLElement>,
        newFilter: CatalogContentType | null
    ) => {
        // Don't allow deselecting all options, default to ALL if user tries to deselect
        if (newFilter !== null) {
            setContentTypeFilter(newFilter)
        } else {
            setContentTypeFilter(CatalogContentType.ALL)
        }
    }

    const contentTypeFilterValue = contentTypeFilter || CatalogContentType.ALL

    return (
        <Box
            className="span-cols-3 col-start-11"
            style={{ textAlign: "right" }}
            sx={{ mb: 2, mt: 2 }}
        >
            <ToggleButtonGroup
                value={contentTypeFilterValue}
                exclusive
                onChange={handleChange}
                aria-label="content type filter"
                size="small"
            >
                <ToggleButton
                    value={CatalogContentType.ALL}
                    aria-label="all content"
                >
                    All
                </ToggleButton>
                <ToggleButton
                    value={CatalogContentType.DATA}
                    aria-label="data only"
                >
                    Data
                </ToggleButton>
                <ToggleButton
                    value={CatalogContentType.WRITING}
                    aria-label="writing only"
                >
                    Writing
                </ToggleButton>
            </ToggleButtonGroup>
        </Box>
    )
}
