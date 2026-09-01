import {
    DbChartTagJoin,
    MinimalTag,
    OwidGdoc,
    OwidGdocType,
} from "@ourworldindata/utils"
import { EditableTags } from "./EditableTags.js"
import { useTags } from "./tagQueries.js"

const UNTAGGABLE_GDOC_TYPES = [
    OwidGdocType.AboutPage,
    OwidGdocType.Author,
    OwidGdocType.Fragment,
    OwidGdocType.Homepage,
]

export function checkCanTagGdocType(type: OwidGdocType | undefined): boolean {
    return !!type && !UNTAGGABLE_GDOC_TYPES.includes(type)
}

export const GdocsTags = ({
    gdoc,
    onSaveTags,
}: {
    gdoc: OwidGdoc
    onSaveTags: (tags: MinimalTag[]) => Promise<void>
}) => {
    const { data: availableTags } = useTags()

    if (!checkCanTagGdocType(gdoc.content.type)) return null

    const suggestions = availableTags ?? []

    const handleSave = async (tags: DbChartTagJoin[]): Promise<void> => {
        const suggestionsById = new Map(suggestions.map((tag) => [tag.id, tag]))
        await onSaveTags(
            tags
                .map((tag) => suggestionsById.get(tag.id))
                .filter((tag) => tag !== undefined)
        )
    }

    return (
        <div className="form-group">
            <h3 className="form-section-heading">Tags</h3>
            <EditableTags
                tags={gdoc.tags ?? []}
                onSave={handleSave}
                suggestions={suggestions}
                disabled={!availableTags}
            />
            <p className="form-text text-muted">
                Tags are saved immediately. Without any topic tags, this
                document will not be filterable in the search or latest page.
            </p>
        </div>
    )
}
