import React from "react"
import {
    OwidGdocAuthorContent,
    OwidGdocAuthorInterface,
} from "@ourworldindata/types"
import { ArticleBlocks } from "../components/ArticleBlocks.js"
import Image from "../components/Image.js"
import ArticleBlock, { getLayout } from "../components/ArticleBlock.js"

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

    return (
        <section className="author-header grid grid-cols-12-full-width span-cols-14">
            <div className="author-header__content span-cols-8 col-start-2">
                <h1 className="author-header__name h1-bold">{title}</h1>
                <div className="author-header__role body-2-regular">{role}</div>
                {bio?.length && (
                    <div className="author-header__bio grid grid-cols-8 span-cols-8 body-2-regular">
                        <ArticleBlocks
                            blocks={bio}
                            containerType="author-header"
                        />
                    </div>
                )}
            </div>
            <div className="grid grid-cols-3 span-cols-3 col-start-10">
                {featuredImage && (
                    <Image
                        filename={featuredImage}
                        alt={`Portrait of ${title}`}
                        className={getLayout("image", "author-header")}
                        containerType="author-header"
                    />
                )}
                {socials && (
                    <ArticleBlock b={socials} containerType="author-header" />
                )}
            </div>
        </section>
    )
}

export const Author = (gdoc: OwidGdocAuthorInterface): JSX.Element => {
    return (
        <div className="grid grid-cols-12-full-width">
            <AuthorHeader {...gdoc} />
        </div>
    )
}
