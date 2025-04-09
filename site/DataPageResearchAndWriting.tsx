import {
    DataPageRelatedResearch,
    DEFAULT_THUMBNAIL_FILENAME,
} from "@ourworldindata/types"
import { formatAuthors } from "@ourworldindata/utils"
import { BAKED_BASE_URL } from "../settings/clientSettings.js"
import Image from "./gdocs/components/Image.js"

export default function DataPageResearchAndWriting({
    relatedResearch,
}: {
    relatedResearch: DataPageRelatedResearch[]
}) {
    return (
        <div className="section-wrapper grid">
            <h2
                className="related-research__title span-cols-3 span-lg-cols-12"
                id="research-and-writing"
            >
                Related research and writing
            </h2>
            <div className="related-research__items grid grid-cols-9 grid-lg-cols-12 span-cols-9 span-lg-cols-12">
                {relatedResearch.map((research) => (
                    <a
                        href={research.url}
                        key={research.url}
                        className="related-research__item grid grid-cols-4 grid-lg-cols-6 grid-sm-cols-12 span-cols-4 span-lg-cols-6 span-sm-cols-12"
                    >
                        <Thumbnail filename={research.imageUrl} />
                        <div className="span-cols-3 span-lg-cols-4 span-sm-cols-9">
                            <h3 className="related-article__title">
                                {research.title}
                            </h3>
                            <div className="related-article__authors body-3-medium-italic">
                                {research.authors &&
                                    research.authors.length &&
                                    formatAuthors(research.authors)}
                            </div>
                        </div>
                    </a>
                ))}
            </div>
        </div>
    )
}

function Thumbnail({ filename }: { filename: string }) {
    if (!filename) {
        return (
            <img
                className="span-lg-cols-2 span-sm-cols-3"
                src={`${BAKED_BASE_URL}/${DEFAULT_THUMBNAIL_FILENAME}`}
            />
        )
    }
    return (
        <Image
            className="span-lg-cols-2 span-sm-cols-3"
            containerType="thumbnail"
            filename={filename}
            shouldLightbox={false}
        />
    )
}
