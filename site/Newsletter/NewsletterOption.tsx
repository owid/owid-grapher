import { Checkbox } from "@ourworldindata/components"

export const NewsletterOption = ({
    id,
    imageSrc,
    title,
    cadence,
    description,
    checked,
    disabled,
    onChange,
}: {
    id: string
    imageSrc?: string
    title: string
    cadence: string
    description: string
    checked: boolean
    disabled?: boolean
    onChange: () => void
}) => (
    <div className="newsletter-option">
        {imageSrc && (
            <img
                className="newsletter-option__image"
                src={imageSrc}
                width={85}
                height={46}
                alt=""
            />
        )}
        <div className="newsletter-option__content">
            <Checkbox
                id={id}
                autoComplete="off"
                checked={checked}
                disabled={disabled}
                onChange={onChange}
                label={
                    <span className="newsletter-option__heading">
                        <span className="newsletter-option__title">
                            {title}
                        </span>{" "}
                        <span className="newsletter-option__cadence">
                            {cadence}
                        </span>
                    </span>
                }
            />
            <p className="newsletter-option__description">{description}</p>
        </div>
    </div>
)
