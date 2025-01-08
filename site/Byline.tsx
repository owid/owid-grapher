import { formatAuthors } from "./clientFormatting.js"

export const Byline = ({
    authors,
    override,
}: {
    authors: string[]
    override?: string
}) => {
    return (
        <div className="authors-byline">
            {override ? (
                <div
                    dangerouslySetInnerHTML={{
                        __html: override,
                    }}
                ></div>
            ) : (
                <a href="/team">{`by ${formatAuthors({
                    authors,
                })}`}</a>
            )}
        </div>
    )
}
