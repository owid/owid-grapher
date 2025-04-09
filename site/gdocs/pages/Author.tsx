import * as React from "react"
import {
    OwidEnrichedGdocBlock,
    OwidGdocAuthorContent,
    OwidGdocAuthorInterface,
} from "@ourworldindata/types"
import { ArticleBlocks } from "../components/ArticleBlocks.js"
import Image from "../components/Image.js"
import ArticleBlock from "../components/ArticleBlock.js"
import { getLayout } from "../components/layout.js"
import cx from "classnames"

type AuthorProps = Omit<
    OwidGdocAuthorInterface,
    "markdown" | "publicationContext" | "revisionId"
> & {
    content: OwidGdocAuthorContent
}

const AuthorHeader = (gdoc: AuthorProps) => {
    const {
        title,
        role,
        bio,
        "featured-image": featuredImage,
        socials,
    } = gdoc.content

    // ✋ This component has two versions, one for small screens and one for
    // medium and up. The medium version is hidden on small screens and vice
    // versa. Please make sure to keep the two versions in sync when applicable.

    return (
        <div className="author-header grid grid-cols-12-full-width span-cols-14">
            <section className="author-header__sm grid grid-cols-12-full-width span-cols-14">
                <div className="col-start-2 span-cols-8">
                    <h1 className="author-header__name">{title}</h1>
                    <div className="author-header__role">{role}</div>
                </div>
                {featuredImage && (
                    <div className="grid grid-cols-3 col-start-11 span-cols-3">
                        <Image
                            filename={featuredImage}
                            alt={`Portrait of ${title}`}
                            className={cx(
                                "author-header__portrait",
                                getLayout("image", "author-header")
                            )}
                            shouldLightbox={false}
                            containerType="author-header"
                        />
                    </div>
                )}
                {socials && (
                    <ArticleBlock b={socials} containerType="author-header" />
                )}
                {bio?.length && (
                    <ArticleBlocks blocks={bio} containerType="author-header" />
                )}
            </section>
            <section className="author-header__md grid grid-cols-12-full-width span-cols-14">
                <div className="span-cols-8 col-start-2 span-md-cols-7 col-md-start-2">
                    <h1 className="author-header__name">{title}</h1>
                    <div className="author-header__role">{role}</div>
                    {bio?.length && (
                        <ArticleBlocks
                            blocks={bio}
                            containerType="author-header"
                        />
                    )}
                </div>
                <div className="grid grid-cols-3 col-start-11 span-cols-3 span-md-cols-4 col-md-start-10">
                    {featuredImage && (
                        <Image
                            filename={featuredImage}
                            alt={`Portrait of ${title}`}
                            className={cx(
                                "author-header__portrait",
                                getLayout("image", "author-header")
                            )}
                            shouldLightbox={false}
                            containerType="author-header"
                        />
                    )}
                    {socials && (
                        <ArticleBlock
                            b={socials}
                            containerType="author-header"
                        />
                    )}
                </div>
            </section>
        </div>
    )
}

export const AuthorWork = ({ blocks }: { blocks: OwidEnrichedGdocBlock[] }) => {
    return (
        <div className="author-work grid grid-cols-12-full-width span-cols-14">
            <ArticleBlocks blocks={blocks} />
        </div>
    )
}

export const Author = (gdoc: AuthorProps): React.ReactElement => {
    return (
        <>
            <AuthorHeader {...gdoc} />
            <AuthorWork blocks={gdoc.content.body} />
        </>
    )
}
