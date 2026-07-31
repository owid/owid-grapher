import { OwidGdocMinimalPostInterface } from "@ourworldindata/types"
import { Thumbnail } from "./Thumbnail.js"

export function DocumentPreview({
    linkedDocument,
}: {
    linkedDocument: OwidGdocMinimalPostInterface
}) {
    const subtitle = linkedDocument.excerpt || linkedDocument.subtitle

    return (
        <div className="document-preview">
            <Thumbnail
                thumbnail={linkedDocument["featured-image"]}
                className="document-preview__thumbnail"
            />
            <div className="document-preview__text">
                <h4 className="document-preview__title">
                    {linkedDocument.title}
                </h4>
                {subtitle && (
                    <p className="document-preview__subtitle">{subtitle}</p>
                )}
            </div>
        </div>
    )
}
