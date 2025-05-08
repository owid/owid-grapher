export const SearchTopicRefinementsHeading = ({
    topics,
}: {
    topics: Set<string>
}) => {
    if (topics.size) return null
    return (
        <h3 className="data-catalog-ribbons__refinements-heading h5-black-caps span-cols-12 col-start-2">
            All areas of research
        </h3>
    )
}
