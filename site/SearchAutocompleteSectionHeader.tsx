import React from "react"
export const SearchAutocompleteSectionHeader = ({
    label,
}: {
    label: string
}) => {
    return (
        <>
            <span className="aa-SourceHeaderTitle">{label}</span>
            <div className="aa-SourceHeaderLine" />
        </>
    )
}
