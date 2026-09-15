import * as React from "react"
import { observer } from "mobx-react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCommentAlt, faPaperPlane } from "@fortawesome/free-solid-svg-icons"
import { observable, action, toJS, computed, makeObservable } from "mobx"
import classnames from "clsx"
import { BAKED_BASE_URL } from "../settings/clientSettings.mjs"
import { stringifyUnknownError } from "@ourworldindata/utils"
import { SiteToolsDialog } from "./SiteToolsDialog.js"

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

class FeedbackFormState {
    feedback: Feedback = new Feedback()
    loading: boolean = false
    done: boolean = false
    error: string | undefined

    constructor() {
        makeObservable(this, {
            loading: observable,
            done: observable,
            error: observable,
        })
    }
}

interface FeedbackFormProps {
    onClose?: () => void
    autofocus?: boolean
    formState?: FeedbackFormState
}

@observer
export class FeedbackForm extends React.Component<FeedbackFormProps> {
    private readonly formState: FeedbackFormState

    constructor(props: FeedbackFormProps) {
        super(props)
        this.formState = props.formState ?? new FeedbackFormState()
    }

    async submit() {
        try {
            await sendFeedback(this.formState.feedback)
            this.formState.feedback.clear()
            this.formState.done = true
        } catch (err) {
            this.formState.error = stringifyUnknownError(err)
        } finally {
            this.formState.loading = false
        }
    }

    @action.bound onSubmit(e: React.SubmitEvent<HTMLFormElement>) {
        e.preventDefault()
        this.formState.done = false
        this.formState.error = undefined
        this.formState.loading = true
        void this.submit()
    }

    @action.bound onName(e: React.ChangeEvent<HTMLInputElement>) {
        this.formState.feedback.name = e.currentTarget.value
    }

    @action.bound onEmail(e: React.ChangeEvent<HTMLInputElement>) {
        this.formState.feedback.email = e.currentTarget.value
    }

    @action.bound onMessage(e: React.ChangeEvent<HTMLTextAreaElement>) {
        this.formState.feedback.message = e.currentTarget.value
    }

    @action.bound onClose() {
        if (this.props.onClose) {
            this.props.onClose()
        }
        // Clear the form after closing, in case the user has a 2nd message to send later.
        this.formState.done = false
    }

    @computed private get specialTopic(): SpecialFeedbackTopic | undefined {
        const { message } = this.formState.feedback
        return topicMatchers.find((matcher) => matcher.regex.test(message))
            ?.topic
    }

    renderBody() {
        const { loading, done } = this.formState
        const { specialTopic } = this
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
                            value={this.formState.feedback.message}
                            autoFocus={autofocus}
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
                            value={this.formState.feedback.name}
                            disabled={loading}
                        />
                    </div>
                    <div className="formSection">
                        <label htmlFor="feedback.email">Email address</label>
                        <input
                            id="feedback.email"
                            className="sentry-mask"
                            onChange={this.onEmail}
                            value={this.formState.feedback.email}
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
                    {this.formState.error ? (
                        <div style={{ color: "red" }}>
                            {this.formState.error}
                        </div>
                    ) : undefined}
                    {this.formState.done ? (
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
                    loading: this.formState.loading,
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
    // Keep drafts and pending submissions across modal close/reopen.
    private readonly formState = new FeedbackFormState()
    isOpen: boolean = false

    constructor(props: Record<string, never>) {
        super(props)

        makeObservable(this, {
            isOpen: observable,
        })
    }

    @action.bound onOpenChange(isOpen: boolean) {
        this.isOpen = isOpen
    }

    @action.bound onClose() {
        this.isOpen = false
    }

    override render() {
        return (
            <SiteToolsDialog
                className="feedbackPromptContainer"
                isOpen={this.isOpen}
                onOpenChange={this.onOpenChange}
                label="Feedback"
                closeLabel="Close feedback form"
                icon={faCommentAlt}
                dataTrackNote="page_open_feedback"
            >
                <FeedbackForm
                    onClose={this.onClose}
                    formState={this.formState}
                />
            </SiteToolsDialog>
        )
    }
}
