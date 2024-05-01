import {
    EnrichedBlockSocials,
    EnrichedSocialLink,
    SocialLinkType,
} from "@ourworldindata/types"
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
        <li className="article-block__social-link">
            <FontAwesomeIcon icon={type ? typeToIcon[type] : faLink} />
            <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                {text}
            </a>
        </li>
    )
}

export function Socials(props: EnrichedBlockSocials & { className?: string }) {
    return (
        <div className={props.className}>
            <ul>
                {props.links.map((link) => (
                    <SocialLink {...link} key={link.url} />
                ))}
            </ul>
        </div>
    )
}
