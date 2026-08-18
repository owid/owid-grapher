import { OwidGdocMinimalPostInterface } from "@ourworldindata/types"

export function DocumentPreview({
    linkedDocument,
}: {
    linkedDocument: OwidGdocMinimalPostInterface
}) {
    const subtitle = linkedDocument.excerpt || linkedDocument.subtitle

    return (
        <div className="document-preview">
            <h4 className="document-preview__title">{linkedDocument.title}</h4>
            {subtitle && (
                <p className="document-preview__subtitle">{subtitle}</p>
            )}
        </div>
    )
}
