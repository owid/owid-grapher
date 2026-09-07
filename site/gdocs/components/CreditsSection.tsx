import { Fragment } from "react"
import cx from "clsx"
import { Contributor, EnrichedBlockText } from "@ourworldindata/types"
import { Byline } from "./Byline.js"
import LinkedAuthor from "./LinkedAuthor.js"
import Paragraph from "./Paragraph.js"

export default function CreditsSection({
    className,
    contributors,
    acknowledgements,
    authors,
    authorRoles,
}: {
    className?: string
    contributors: Contributor[]
    acknowledgements: EnrichedBlockText[]
    authors?: string[]
    authorRoles?: Record<string, string>
}) {
    return (
        <section className={cx("credits-section", className)}>
            <hr className="credits-section__divider col-start-2 span-cols-12" />
            <div className="credits-section__body col-start-4 span-cols-8 col-md-start-3 span-md-cols-10 col-sm-start-2 span-sm-cols-12">
                <h3 className="credits-section__heading">
                    Contributors &amp; acknowledgements
                </h3>
                {authors && authors.length > 0 && (
                    <p className="credits-section__paragraph">
                        <Byline names={authors} authorRoles={authorRoles} />.
                    </p>
                )}
                {contributors.length > 0 && (
                    <p className="credits-section__paragraph">
                        <ContributorList contributors={contributors} />.
                    </p>
                )}
                {acknowledgements.map((block, index) => (
                    <Paragraph
                        key={index}
                        d={block}
                        className="credits-section__paragraph"
                    />
                ))}
            </div>
        </section>
    )
}

function ContributorList({ contributors }: { contributors: Contributor[] }) {
    return contributors.map((contributor, index) => (
        <Fragment key={contributor.name}>
            <LinkedAuthor name={contributor.name} role={contributor.role} />
            {index < contributors.length - 1 && ", "}
        </Fragment>
    ))
}
