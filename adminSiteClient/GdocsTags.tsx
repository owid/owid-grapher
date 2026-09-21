import { useEffect, useRef, useState } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCheck } from "@fortawesome/free-solid-svg-icons"
import { DbChartTagJoin, MinimalTag, OwidGdoc } from "@ourworldindata/utils"
import { EditableTags } from "./EditableTags.js"
import { checkCanTagGdocType } from "./gdocsTagging.js"
import { useTags } from "./tagQueries.js"

const SAVED_INDICATOR_DURATION_MS = 2500

export const GdocsTags = ({
    gdoc,
    onSaveTags,
}: {
    gdoc: OwidGdoc
    onSaveTags: (tags: MinimalTag[]) => Promise<void>
}) => {
    const { data: availableTags } = useTags()
    // Incremented on every save; keys the indicator so its fade-out restarts
    const [saveCount, setSaveCount] = useState(0)
    const [showSaved, setShowSaved] = useState(false)
    const savedTimeoutRef = useRef<number>(undefined)

    useEffect(() => () => window.clearTimeout(savedTimeoutRef.current), [])

    if (!checkCanTagGdocType(gdoc.content.type)) return null

    // Tag badges need the tag graph metadata to render
    if (!availableTags) return null

    const suggestions = availableTags

    const handleSave = async (tags: DbChartTagJoin[]): Promise<void> => {
        const suggestionsById = new Map(suggestions.map((tag) => [tag.id, tag]))
        await onSaveTags(
            tags
                .map((tag) => suggestionsById.get(tag.id))
                .filter((tag) => tag !== undefined)
        )
        setSaveCount((count) => count + 1)
        setShowSaved(true)
        window.clearTimeout(savedTimeoutRef.current)
        savedTimeoutRef.current = window.setTimeout(
            () => setShowSaved(false),
            SAVED_INDICATOR_DURATION_MS
        )
    }

    return (
        <div className="form-group">
            <h3 className="form-section-heading">
                Tags
                {showSaved && (
                    <span key={saveCount} className="GdocsTags__saved">
                        <FontAwesomeIcon icon={faCheck} /> Saved!
                    </span>
                )}
            </h3>
            <EditableTags
                tags={gdoc.tags ?? []}
                onSave={handleSave}
                suggestions={suggestions}
            />
            <p className="form-text text-muted">
                Tags are saved immediately. Without any topic tags, this
                document will not be filterable in the search or latest page.
            </p>
        </div>
    )
}
