import * as React from "react"
import { Checkbox } from "@ourworldindata/components"

/**
 * A newsletter with a checkbox to opt in or out of it, rendered by both the
 * subscribe form and the magic-link preferences form. The copy lives in the
 * wrappers below so the two forms can't drift apart.
 */
const NewsletterOption = ({
    id,
    imageSrc,
    title,
    cadence,
    description,
    checked,
    onChange,
    children,
}: {
    id: string
    imageSrc: string
    title: string
    cadence: string
    description: string
    checked: boolean
    onChange: () => void
    children?: React.ReactNode
}) => (
    <div className="newsletter-option">
        <img
            className="newsletter-option__image"
            src={imageSrc}
            width={85}
            height={46}
            alt=""
        />
        <div className="newsletter-option__content">
            <Checkbox
                id={id}
                checked={checked}
                onChange={onChange}
                label={
                    <>
                        <span className="newsletter-option__title">
                            {title}
                        </span>{" "}
                        <span className="newsletter-option__cadence">
                            {cadence}
                        </span>
                    </>
                }
            />
            <p className="newsletter-option__description">{description}</p>
            {children}
        </div>
    </div>
)

export const OwidBriefOption = ({
    id,
    checked,
    onChange,
    showExampleLink,
}: {
    id: string
    checked: boolean
    onChange: () => void
    showExampleLink?: boolean
}) => (
    <NewsletterOption
        id={id}
        imageSrc="/images/biweekly-newsletter.webp"
        title="The OWID Brief"
        cadence="Twice a month"
        description="Stay up to date with our latest work plus curated highlights from across Our World in Data, twice a month."
        checked={checked}
        onChange={onChange}
    >
        {showExampleLink && (
            <a
                className="newsletter-option__example"
                href="https://mailchi.mp/ourworldindata/owid-brief-2025-11-14"
            >
                See example OWID Brief newsletter
            </a>
        )}
    </NewsletterOption>
)

export const FollowTopicsOption = ({
    id,
    checked,
    onChange,
}: {
    id: string
    checked: boolean
    onChange: () => void
}) => (
    <NewsletterOption
        id={id}
        imageSrc="/images/data-insights.webp"
        title="Follow Topics"
        cadence="Pick your cadence"
        description="Receive updates on the topics you follow as we publish them."
        checked={checked}
        onChange={onChange}
    />
)
