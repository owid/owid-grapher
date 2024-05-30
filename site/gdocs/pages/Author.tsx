import React from "react"
import {
    OwidEnrichedGdocBlock,
    OwidGdocAuthorContent,
    OwidGdocAuthorInterface,
} from "@ourworldindata/types"
import { ArticleBlocks } from "../components/ArticleBlocks.js"
import Image from "../components/Image.js"
import ArticleBlock, { getLayout } from "../components/ArticleBlock.js"
import cx from "classnames"

export interface AuthorProps {
    content: OwidGdocAuthorContent
}

const AuthorHeader = (gdoc: OwidGdocAuthorInterface) => {
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
                <div className="grid grid-cols-8 span-cols-8 col-start-2">
                    <h1 className="author-header__name span-cols-8">{title}</h1>
                    <div className="author-header__role span-cols-8">
                        {role}
                    </div>
                    {bio?.length && (
                        <ArticleBlocks
                            blocks={bio}
                            containerType="author-header"
                        />
                    )}
                </div>
                <div className="grid grid-cols-3 col-start-11 span-cols-3">
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

export const Author = (gdoc: OwidGdocAuthorInterface): React.ReactElement => {
    return (
        <>
            <AuthorHeader {...gdoc} />
            <AuthorWork blocks={gdoc.content.body} />
        </>
    )
}
