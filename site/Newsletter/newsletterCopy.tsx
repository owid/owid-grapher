export const OWID_BRIEF_TITLE = "The OWID Brief"
export const OWID_BRIEF_CADENCE = "Twice a month"
export const OWID_BRIEF_DESCRIPTION =
    "Stay up to date with our latest work plus curated highlights from across Our World in Data, twice a month."

export const FOLLOW_TOPICS_TITLE = "Follow Topics"
export const FOLLOW_TOPICS_CADENCE = "Pick your cadence"
export const FOLLOW_TOPICS_DESCRIPTION =
    "Receive updates on the topics you follow as we publish them, at your preferred frequency."

export const PrivacyNotice = ({ className }: { className: string }) => (
    <div className={className}>
        By subscribing you are agreeing to the terms of our{" "}
        <a href="/privacy-policy">privacy policy</a>.
    </div>
)
