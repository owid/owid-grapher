import * as React from "react"
import { BAKED_BASE_URL } from "settings"
import { webpack } from "utils/server/staticGen"

export const Head = (props: {
    canonicalUrl: string
    pageTitle?: string
    pageDesc?: string
    imageUrl?: string
    children?: any
}) => {
    const { canonicalUrl } = props
    const pageTitle = props.pageTitle || `Our World in Data`
    const fullPageTitle = props.pageTitle
        ? `${props.pageTitle} - Our World in Data`
        : `Our World in Data`
    const pageDesc =
        props.pageDesc ||
        "Research and data to make progress against the world’s largest problems"
    const imageUrl = props.imageUrl || `${BAKED_BASE_URL}/default-thumbnail.jpg`

    return (
        <head>
            <meta
                name="viewport"
                content="width=device-width, initial-scale=1"
            />
            <title>{fullPageTitle}</title>
            <meta name="description" content={pageDesc} />
            <link rel="canonical" href={canonicalUrl} />
            <link
                rel="alternate"
                type="application/atom+xml"
                href="/atom.xml"
            />
            <link
                rel="apple-touch-icon"
                sizes="180x180"
                href="/apple-touch-icon.png"
            />
            <meta property="fb:app_id" content="1149943818390250" />
            <meta property="og:url" content={canonicalUrl} />
            <meta property="og:title" content={pageTitle} />
            <meta property="og:description" content={pageDesc} />
            <meta property="og:image" content={imageUrl} />
            <meta property="og:site_name" content="Our World in Data" />
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:site" content="@OurWorldInData" />
            <meta name="twitter:creator" content="@OurWorldInData" />
            <meta name="twitter:title" content={pageTitle} />
            <meta name="twitter:description" content={pageDesc} />
            <meta name="twitter:image" content={imageUrl} />
            <link
                href="https://fonts.googleapis.com/css?family=Lato:300,400,400i,700,700i|Playfair+Display:400,700"
                rel="stylesheet"
            />
            <link rel="stylesheet" href={webpack("commons.css", "site")} />
            <link rel="stylesheet" href={webpack("owid.css", "site")} />
            {props.children}
        </head>
    )
}
