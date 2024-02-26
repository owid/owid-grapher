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
    faXTwitter,
    faYoutube,
} from "@fortawesome/free-brands-svg-icons"
import { faGlobe } from "@fortawesome/free-solid-svg-icons"

function SocialLink({ url, text, type }: EnrichedSocialLink) {
    const typeToIcon: Record<SocialLinkType, IconDefinition> = {
        x: faXTwitter,
        facebook: faFacebook,
        instagram: faInstagram,
        linkedin: faLinkedin,
        youtube: faYoutube,
    }

    return (
        <li className="article-block__social-link">
            <FontAwesomeIcon icon={type ? typeToIcon[type] : faGlobe} />
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
