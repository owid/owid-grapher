import { EnrichedSocialLink, SocialLinkType } from "@ourworldindata/types"
import React from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import {
    IconDefinition,
    faFacebook,
    faInstagram,
    faLinkedin,
    faMastodon,
    faThreads,
    faXTwitter,
    faYoutube,
    faBluesky,
} from "@fortawesome/free-brands-svg-icons"
import { faEnvelope, faLink } from "@fortawesome/free-solid-svg-icons"

function SocialLink({ url, text, type }: EnrichedSocialLink) {
    const typeToIcon: Record<SocialLinkType, IconDefinition> = {
        x: faXTwitter,
        facebook: faFacebook,
        instagram: faInstagram,
        linkedin: faLinkedin,
        youtube: faYoutube,
        threads: faThreads,
        mastodon: faMastodon,
        bluesky: faBluesky,
        email: faEnvelope,
        link: faLink,
    }

    return (
        <li className="article-block__social-link social-link">
            <FontAwesomeIcon icon={type ? typeToIcon[type] : faLink} />
            <a href={url} target="_blank" rel="noopener">
                {text}
            </a>
        </li>
    )
}

export function Socials({
    className,
    links,
}: {
    className?: string
    links: EnrichedSocialLink[]
}) {
    return (
        <div className={className}>
            <ul>
                {links.map((link) => (
                    <SocialLink key={link.url} {...link} />
                ))}
            </ul>
        </div>
    )
}
