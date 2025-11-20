import * as React from "react"
import { observer } from "mobx-react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faCommentAlt,
    faTimes,
    faPaperPlane,
} from "@fortawesome/free-solid-svg-icons"
import { observable, action, toJS, computed, makeObservable } from "mobx"
import classnames from "classnames"
import { BAKED_BASE_URL } from "../settings/clientSettings.js"
import { stringifyUnknownError } from "@ourworldindata/utils"
import { createRoot } from "react-dom/client"

const sendFeedback = async (feedback: Feedback) => {
    const json = {
        ...toJS(feedback),
        environment: `Current URL: ${window.location.href}\nUser Agent: ${navigator.userAgent}\nViewport: ${window.innerWidth}x${window.innerHeight}`,
    }

    return await fetch("https://feedback.owid.io", {
        method: "POST",
        headers: { "Content-Type": "application/json;charset=UTF-8" },
        body: JSON.stringify(json),
    }).then((res) => {
        if (!res.ok)
            throw new Error(
                `Sending feedback failed: ${res.status} ${res.statusText}`
            )
    })
}

class Feedback {
    name: string = ""
    email: string = ""
    message: string = ""
    environment: string = ""

    constructor() {
        makeObservable(this, {
            name: observable,
            email: observable,
            message: observable,
        })
    }

    @action.bound clear() {
        this.name = ""
        this.email = ""
        this.message = ""
    }
}

const vaccinationRegex = /vaccination|vaccine|doses|vaccinat/i
const licensingRegex = /license|licence|licensing|copyright|permission|permit/i
const citationRegex = /cite|citation|citing|reference/i
const translateRegex = /translat/i
const fundingRegex = /\b(fund|funds|funding|funded|funder)\b/i
const reusingChartsRegex = /(use|reuse|using|reusing)\s+(chart|image|picture)/i
const reusingDataRegex =
    /(use|reuse|using|reusing|utilize|utilizing|utilise|utilising)\s+data/i
const visualizationToolRegex =
    /grapher|grapher\s+reusability|(use|reuse|using|reusing)\s+grapher|data\s+viz\s+tool|data\s+visuali[sz]ation\s+tool|visuali[sz]ation\s+software/i
const logoRegex = /logo/i
const teachingRegex = /teach|teaching|teacher|teachers/i

enum SpecialFeedbackTopic {
    Vaccination,
    Licensing,
    Citation,
    Translation,
    Funding,
    ReusingCharts,
    ReusingData,
    VisualizationTool,
    Logo,
    Teaching,
}

interface SpecialTopicMatcher {
    regex: RegExp
    topic: SpecialFeedbackTopic
}

const topicMatchers: SpecialTopicMatcher[] = [
    { regex: vaccinationRegex, topic: SpecialFeedbackTopic.Vaccination },
    { regex: licensingRegex, topic: SpecialFeedbackTopic.Licensing },
    { regex: citationRegex, topic: SpecialFeedbackTopic.Citation },
    { regex: translateRegex, topic: SpecialFeedbackTopic.Translation },
    { regex: fundingRegex, topic: SpecialFeedbackTopic.Funding },
    { regex: reusingChartsRegex, topic: SpecialFeedbackTopic.ReusingCharts },
    {
        regex: visualizationToolRegex,
        topic: SpecialFeedbackTopic.VisualizationTool,
    },
    { regex: reusingDataRegex, topic: SpecialFeedbackTopic.ReusingData },
    { regex: logoRegex, topic: SpecialFeedbackTopic.Logo },
    { regex: teachingRegex, topic: SpecialFeedbackTopic.Teaching },
]

const vaccineNotice = (
    <a
        key="vaccineNotice"
        href={`${BAKED_BASE_URL}/covid-vaccinations#frequently-asked-questions`}
        target="_blank"
        rel="noopener"
    >
        COVID-19 vaccine questions
    </a>
)

const copyrightNotice = (
    <a
        key="copyrightNotice"
        href={`${BAKED_BASE_URL}/faqs#can-i-reuse-or-republish-your-charts`}
        target="_blank"
        rel="noopener"
    >
        Copyright questions
    </a>
)
const citationNotice = (
    <a
        key="citationNotice"
        href={`${BAKED_BASE_URL}/faqs#how-should-i-cite-your-charts`}
        target="_blank"
        rel="noopener"
    >
        How to cite our work
    </a>
)
const translateNotice = (
    <a
        key="translateNotice"
        href={`${BAKED_BASE_URL}/faqs#can-i-translate-your-work-into-another-language`}
        target="_blank"
        rel="noopener"
    >
        Translating our work
    </a>
)
const fundingNotice = (
    <a
        key="fundingNotice"
        href={`${BAKED_BASE_URL}/faqs#how-are-you-funded`}
        target="_blank"
        rel="noopener"
    >
        How are you funded?
    </a>
)
const reusingChartsNotice = (
    <a
        key="reusingChartsNotice"
        href={`${BAKED_BASE_URL}/faqs#can-i-reuse-or-republish-your-charts`}
        target="_blank"
        rel="noopener"
    >
        Reusing our charts
    </a>
)
const reusingDataNotice = (
    <a
        key="reusingDataNotice"
        href={`${BAKED_BASE_URL}/faqs#can-i-reuse-or-republish-your-data`}
        target="_blank"
        rel="noopener"
    >
        Reusing our data
    </a>
)
const visualizationToolNotice = (
    <a
        key="visualizationToolNotice"
        href={`${BAKED_BASE_URL}/faqs#what-software-do-you-use-for-your-visualizations-and-can-i-use-it`}
        target="_blank"
        rel="noopener"
    >
        Our visualization tool
    </a>
)
const logoNotice = (
    <a
        key="logoNotice"
        href={`${BAKED_BASE_URL}/faqs#can-i-use-the-our-world-in-data-name-or-logo`}
        target="_blank"
        rel="noopener"
    >
        Can I use your logo?
    </a>
)
const teachingNotice = (
    <a
        key="teachingNotice"
        href={`${BAKED_BASE_URL}/faqs#can-i-use-your-work-for-teaching`}
        target="_blank"
        rel="noopener"
    >
        Teaching with OWID
    </a>
)

const topicNotices = new Map<SpecialFeedbackTopic, React.ReactElement>([
    [SpecialFeedbackTopic.Vaccination, vaccineNotice],
    [SpecialFeedbackTopic.Citation, citationNotice],
    [SpecialFeedbackTopic.Licensing, copyrightNotice],
    [SpecialFeedbackTopic.Translation, translateNotice],
    [SpecialFeedbackTopic.Funding, fundingNotice],
    [SpecialFeedbackTopic.ReusingCharts, reusingChartsNotice],
    [SpecialFeedbackTopic.ReusingData, reusingDataNotice],
    [SpecialFeedbackTopic.VisualizationTool, visualizationToolNotice],
    [SpecialFeedbackTopic.Logo, logoNotice],
    [SpecialFeedbackTopic.Teaching, teachingNotice],
])

interface FeedbackFormProps {
    onClose?: () => void
    autofocus?: boolean
}

@observer
export class FeedbackForm extends React.Component<FeedbackFormProps> {
    feedback: Feedback = new Feedback()
    loading: boolean = false
    done: boolean = false
    error: string | undefined

    constructor(props: FeedbackFormProps) {
        super(props)

        makeObservable(this, {
            loading: observable,
            done: observable,
            error: observable,
        })
    }

    async submit() {
        try {
            await sendFeedback(this.feedback)
            this.feedback.clear()
            this.done = true
        } catch (err) {
            this.error = stringifyUnknownError(err)
        } finally {
            this.loading = false
        }
    }

    @action.bound onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        this.done = false
        this.error = undefined
        this.loading = true
        void this.submit()
    }

    @action.bound onName(e: React.ChangeEvent<HTMLInputElement>) {
        this.feedback.name = e.currentTarget.value
    }

    @action.bound onEmail(e: React.ChangeEvent<HTMLInputElement>) {
        this.feedback.email = e.currentTarget.value
    }

    @action.bound onMessage(e: React.ChangeEvent<HTMLTextAreaElement>) {
        this.feedback.message = e.currentTarget.value
    }

    @action.bound onClose() {
        if (this.props.onClose) {
            this.props.onClose()
        }
        // Clear the form after closing, in case the user has a 2nd message to send later.
        this.done = false
    }

    @computed private get specialTopic(): SpecialFeedbackTopic | undefined {
        const { message } = this.feedback
        return topicMatchers.find((matcher) => matcher.regex.test(message))
            ?.topic
    }

    renderBody() {
        const { loading, done, specialTopic } = this
        const autofocus = this.props.autofocus ?? true

        if (done) {
            return (
                <div className="doneMessage">
                    <div className="icon">
                        <FontAwesomeIcon icon={faPaperPlane} />
                    </div>
                    <div className="message">
                        <h3>Thank you for your feedback</h3>
                        <p>
                            We read all feedback, but due to a high volume of
                            messages we are not able to reply to all.
                        </p>
                    </div>
                    <div aria-label="Close feedback form" className="actions">
                        <button onClick={this.onClose}>Close</button>
                    </div>
                </div>
            )
        }

        const notices =
            specialTopic !== undefined
                ? topicNotices.get(specialTopic)
                : undefined
        return (
            <React.Fragment>
                <div className="header">Leave us feedback</div>
                <div className="notice">
                    <p>
                        <strong>Have a question?</strong> You may find an answer
                        in{" "}
                        <a
                            href={`${BAKED_BASE_URL}/faqs`}
                            target="_blank"
                            rel="noopener"
                        >
                            <strong>FAQs</strong>
                        </a>
                        .
                    </p>
                </div>
                <div className="formBody">
                    <div className="formSection formSectionExpand">
                        <label htmlFor="feedback.message">Message</label>
                        <textarea
                            id="feedback.message"
                            className="sentry-mask"
                            onChange={this.onMessage}
                            rows={5}
                            minLength={30}
                            required
                            disabled={loading}
                        />
                        {notices ? (
                            <div className="topic-notice">
                                Your question may be answered in{" "}
                                <strong>{notices}</strong>.
                            </div>
                        ) : null}
                    </div>
                    <div className="formSection">
                        <label htmlFor="feedback.name">Your name</label>
                        <input
                            id="feedback.name"
                            className="sentry-mask"
                            onChange={this.onName}
                            autoFocus={autofocus}
                            disabled={loading}
                        />
                    </div>
                    <div className="formSection">
                        <label htmlFor="feedback.email">Email address</label>
                        <input
                            id="feedback.email"
                            className="sentry-mask"
                            onChange={this.onEmail}
                            type="email"
                            disabled={loading}
                        />
                        <small className="form-text text-muted">
                            Your name and email will only be used to reply to
                            you and not for any other purpose. If you do not
                            give a valid email, we will not be able to reply to
                            you.
                        </small>
                    </div>
                    {this.error ? (
                        <div style={{ color: "red" }}>{this.error}</div>
                    ) : undefined}
                    {this.done ? (
                        <div style={{ color: "green" }}>
                            Thanks for your feedback!
                        </div>
                    ) : undefined}
                </div>
                <div className="footer">
                    <button
                        aria-label="Submit feedback"
                        type="submit"
                        disabled={loading}
                    >
                        Send message
                    </button>
                </div>
            </React.Fragment>
        )
    }

    override render() {
        return (
            <form
                className={classnames("FeedbackForm", {
                    loading: this.loading,
                })}
                onSubmit={this.onSubmit}
            >
                {this.renderBody()}
            </form>
        )
    }
}

@observer
export class FeedbackPrompt extends React.Component {
    isOpen: boolean = false

    constructor(props: Record<string, never>) {
        super(props)

        makeObservable(this, {
            isOpen: observable,
        })
    }

    @action.bound toggleOpen() {
        this.isOpen = !this.isOpen
    }

    @action.bound onClose() {
        this.isOpen = false
    }

    @action.bound onClickOutside() {
        this.onClose()
    }

    override render() {
        return (
            <div
                className={`feedbackPromptContainer${
                    this.isOpen ? " active" : ""
                }`}
            >
                {/* We are keeping the form always rendered to avoid wiping all contents
                when a user accidentally closes the form */}
                <div style={{ display: this.isOpen ? "block" : "none" }}>
                    <div className="overlay" onClick={this.onClickOutside} />
                    <div className="box">
                        <FeedbackForm onClose={this.onClose} />
                    </div>
                </div>
                {this.isOpen ? (
                    <button
                        aria-label="Close feedback form"
                        className="prompt"
                        onClick={this.toggleOpen}
                    >
                        <FontAwesomeIcon icon={faTimes} /> Close
                    </button>
                ) : (
                    <button
                        aria-label="Open feedback form"
                        className="prompt"
                        data-track-note="page_open_feedback"
                        onClick={this.toggleOpen}
                    >
                        <FontAwesomeIcon icon={faCommentAlt} /> Feedback
                    </button>
                )}
            </div>
        )
    }
}

export function runFeedbackPage() {
    const elem = document.querySelector(".FeedbackPage main")
    if (!elem) throw new Error("FeedbackPage main element not found in DOM")

    const root = createRoot(elem)
    root.render(
        <div className="box">
            <FeedbackForm />
        </div>
    )
}
