import {
    faMinus,
    faPlus,
    faDice,
    faCheck,
    faCross,
} from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import {
    getErrorMessageRelatedQuestionUrl,
    Grapher,
    LogoOption,
    RelatedQuestionsConfig,
    Topic,
} from "@ourworldindata/grapher"
import { getIndexableKeys, slugify } from "@ourworldindata/utils"
import { action, computed, observable, runInAction } from "mobx"
import { observer } from "mobx-react"
import React from "react"
import Select from "react-select"
import { TOPICS_CONTENT_GRAPH } from "../settings/clientSettings.js"
import { ChartEditor } from "./ChartEditor.js"
import {
    AutoTextField,
    BindAutoString,
    BindString,
    Button,
    RadioGroup,
    Section,
    TextField,
    Toggle,
} from "./Forms.js"
import { match } from "ts-pattern"

type AiTextSuggestionStateNotRequested = {
    state: "AiTextSuggestionStateNotRequested"
}

type AiTextSuggestionStatePending = {
    state: "AiTextSuggestionStatePending"
}

type AiTextSuggestionStateReceived = {
    state: "AiTextSuggestionStateReceived"
    suggestion: string
}

type AiTextSuggestionState =
    | AiTextSuggestionStateNotRequested
    | AiTextSuggestionStatePending
    | AiTextSuggestionStateReceived

interface AiTextSuggesterProps {
    title: string
    subtitle: string
    onSuggestionAccepted: (suggestion: string) => void
}

const DEFAULT_SUGGESTION_PROMPT: string = `You are a copy writing assistant for Our World In Data. At OWID we annotate charts with important information. Screen real estate is scarce, so we have to try to be brief while retaining all the important information.

You are presented with the title and subtitle of a chart. Your task is to create a cleaned up subtitle. If possible, make the subtitle a bit shorter, easier to read yet, without redunandant information and informative.

Take into account that the title already conveys what the chart is about and thus the subtitle should not simply restate the title. Return only the subtitle.
`

@observer
export class AiSubitleSuggester extends React.Component<AiTextSuggesterProps> {
    @observable suggestionState: AiTextSuggestionState = {
        state: "AiTextSuggestionStateNotRequested",
    }

    @action.bound
    async requestSuggestion(title: string, subtitle: string): Promise<void> {
        const messages = [
            {
                kind: "systemMessage",
                message: DEFAULT_SUGGESTION_PROMPT,
            },
            {
                kind: "userMessage",
                message: `TITLE: ${title}

SUBTITLE:
${subtitle}`,
            },
        ]
        this.suggestionState = { state: "AiTextSuggestionStatePending" }
        const response = await fetch("openai", { data: messages })
        this.suggestionState = {
            state: "AiTextSuggestionStateReceived",
            suggestion: response,
        }
    }

    render() {
        const { suggestionState } = this
        const { title, subtitle, onSuggestionAccepted } = this.props
        return match(suggestionState)
            .with({ state: "AiTextSuggestionStateNotRequested" }, () => {
                return (
                    <Button
                        onClick={() => this.requestSuggestion(title, subtitle)}
                    >
                        <FontAwesomeIcon icon={faDice} /> Request AI suggestion
                        question
                    </Button>
                )
            })
            .with({ state: "AiTextSuggestionStatePending" }, () => {
                return <div>Loading...</div>
            })
            .with({ state: "AiTextSuggestionStateReceived" }, (state) => {
                return (
                    <>
                        <textarea readOnly={true}>{state.suggestion}</textarea>
                        <Button
                            onClick={() =>
                                onSuggestionAccepted(state.suggestion)
                            }
                        >
                            <FontAwesomeIcon icon={faCheck} /> Accept
                        </Button>
                        <Button
                            onClick={() =>
                                this.requestSuggestion(title, subtitle)
                            }
                        >
                            <FontAwesomeIcon icon={faCross} /> Reject
                        </Button>
                    </>
                )
            })
    }
}

@observer
export class EditorTextTab extends React.Component<{ editor: ChartEditor }> {
    @action.bound onSlug(slug: string) {
        this.props.editor.grapher.slug = slugify(slug)
    }

    @action.bound onChangeLogo(value: string) {
        if (value === "none") {
            this.props.editor.grapher.hideLogo = true
        } else {
            this.props.editor.grapher.hideLogo = undefined
            this.props.editor.grapher.logo = (value as LogoOption) || undefined
        }
    }

    @action.bound onAddRelatedQuestion() {
        const { grapher } = this.props.editor
        grapher.relatedQuestions.push({
            text: "",
            url: "",
        })
    }

    @action.bound onRemoveRelatedQuestion(idx: number) {
        const { grapher } = this.props.editor
        grapher.relatedQuestions.splice(idx, 1)
    }

    @action.bound onToggleTitleAnnotationEntity(value: boolean) {
        const { grapher } = this.props.editor
        grapher.hideAnnotationFieldsInTitle ??= {}
        grapher.hideAnnotationFieldsInTitle.entity = value || undefined
    }

    @action.bound onToggleTitleAnnotationTime(value: boolean) {
        const { grapher } = this.props.editor
        grapher.hideAnnotationFieldsInTitle ??= {}
        grapher.hideAnnotationFieldsInTitle.time = value || undefined
    }

    @action.bound onToggleTitleAnnotationChangeInPrefix(value: boolean) {
        const { grapher } = this.props.editor
        grapher.hideAnnotationFieldsInTitle ??= {}
        grapher.hideAnnotationFieldsInTitle.changeInPrefix = value || undefined
    }

    @computed get errorMessages() {
        const { invalidDetailReferences } = this.props.editor.manager
        const keys = getIndexableKeys(invalidDetailReferences)

        const errorMessages: Partial<Record<(typeof keys)[number], string>> = {}

        keys.forEach((key) => {
            const references = invalidDetailReferences[key]
            if (references.length) {
                errorMessages[
                    key
                ] = `Invalid detail(s) specified: ${references.join(", ")}`
            }
        })
        return errorMessages
    }

    @computed get showChangeInPrefixToggle() {
        const { grapher } = this.props.editor
        return (
            grapher.isLineChart &&
            (grapher.isRelativeMode || grapher.canToggleRelativeMode)
        )
    }

    render() {
        const { grapher, references } = this.props.editor
        const { subtitle, title } = grapher
        const { relatedQuestions } = grapher

        return (
            <div className="EditorTextTab">
                <Section name="Header">
                    <BindAutoString
                        field="title"
                        store={grapher}
                        auto={grapher.displayTitle}
                        softCharacterLimit={100}
                    />
                    <Toggle
                        label="Hide automatic entity (where possible)"
                        value={!!grapher.hideAnnotationFieldsInTitle?.entity}
                        onValue={this.onToggleTitleAnnotationEntity}
                    />
                    <Toggle
                        label="Hide automatic time (where possible)"
                        value={!!grapher.hideAnnotationFieldsInTitle?.time}
                        onValue={this.onToggleTitleAnnotationTime}
                    />
                    {this.showChangeInPrefixToggle && (
                        <Toggle
                            label="Don't prepend 'Change in' in relative line charts"
                            value={
                                !!grapher.hideAnnotationFieldsInTitle
                                    ?.changeInPrefix
                            }
                            onValue={this.onToggleTitleAnnotationChangeInPrefix}
                        />
                    )}
                    <hr />
                    <AutoTextField
                        label="/grapher"
                        value={grapher.displaySlug}
                        onValue={this.onSlug}
                        isAuto={grapher.slug === undefined}
                        onToggleAuto={() =>
                            (grapher.slug =
                                grapher.slug === undefined
                                    ? grapher.displaySlug
                                    : undefined)
                        }
                        helpText="Human-friendly URL for this chart"
                    />
                    <BindString
                        field="subtitle"
                        store={grapher}
                        placeholder="Briefly describe the context of the data. It's best to avoid duplicating any information which can be easily inferred from other visual elements of the chart."
                        textarea
                        softCharacterLimit={280}
                        errorMessage={this.errorMessages.subtitle}
                    />
                    <AiSubitleSuggester
                        title={title ?? ""}
                        subtitle={subtitle}
                        onSuggestionAccepted={(text: string) =>
                            action(() => (grapher.subtitle = text))
                        }
                    />
                    <RadioGroup
                        label="Logo"
                        options={[
                            { label: "OWID", value: "owid" },
                            { label: "CORE+OWID", value: "core+owid" },
                            { label: "GV+OWID", value: "gv+owid" },
                            { label: "No logo", value: "none" },
                        ]}
                        value={
                            grapher.hideLogo ? "none" : grapher.logo || "owid"
                        }
                        onChange={this.onChangeLogo}
                    />
                </Section>
                <Section name="Footer">
                    <BindAutoString
                        label="Source"
                        field="sourceDesc"
                        store={grapher}
                        auto={grapher.sourcesLine}
                        helpText="Short comma-separated list of source names"
                        softCharacterLimit={60}
                    />
                    <BindString
                        label="Origin url"
                        field="originUrl"
                        store={grapher}
                        placeholder={grapher.originUrlWithProtocol}
                        helpText="The page containing this chart where more context can be found"
                    />
                    {references && references.length > 0 && (
                        <div className="originSuggestions">
                            <p>Origin url suggestions</p>
                            <ul>
                                {references.map((post) => (
                                    <li key={post.id}>{post.url}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <BindString
                        label="Footer note"
                        field="note"
                        store={grapher}
                        helpText="Any important clarification needed to avoid miscommunication"
                        softCharacterLimit={140}
                        errorMessage={this.errorMessages.note}
                        textarea
                    />
                </Section>

                <TopicsSection
                    allTopics={this.props.editor.allTopics}
                    grapher={grapher}
                />

                <Section name="Related">
                    {relatedQuestions.map(
                        (question: RelatedQuestionsConfig, idx: number) => (
                            <div key={idx}>
                                <TextField
                                    label="Related question"
                                    value={question.text}
                                    onValue={action((value: string) => {
                                        question.text = value
                                    })}
                                    placeholder="e.g. How did countries respond to the pandemic?"
                                    helpText="Short question promoting exploration of related content"
                                    softCharacterLimit={50}
                                />
                                {question.text && (
                                    <TextField
                                        label="URL"
                                        value={question.url}
                                        onValue={action((value: string) => {
                                            question.url = value
                                        })}
                                        placeholder="e.g. https://ourworldindata.org/coronavirus"
                                        helpText="Page or section of a page where the answer to the previous question can be found."
                                        errorMessage={getErrorMessageRelatedQuestionUrl(
                                            question
                                        )}
                                    />
                                )}
                                <Button
                                    onClick={() =>
                                        this.onRemoveRelatedQuestion(idx)
                                    }
                                >
                                    <FontAwesomeIcon icon={faMinus} /> Remove
                                    related question
                                </Button>
                            </div>
                        )
                    )}
                    {!relatedQuestions.length && (
                        <Button onClick={this.onAddRelatedQuestion}>
                            <FontAwesomeIcon icon={faPlus} /> Add related
                            question
                        </Button>
                    )}
                </Section>
                <Section name="Misc">
                    <BindString
                        label="Internal author notes"
                        field="internalNotes"
                        store={grapher}
                        placeholder="e.g. WIP, needs review, etc"
                        textarea
                    />
                    <BindString
                        label="Variant name"
                        field="variantName"
                        store={grapher}
                        placeholder="e.g. IHME"
                        helpText="Optional variant name for distinguishing charts with the same title"
                    />
                </Section>
            </div>
        )
    }
}
@observer
class TopicsSection extends React.Component<{
    allTopics: Topic[]
    grapher: Grapher
}> {
    render() {
        const { grapher } = this.props

        return (
            <Section name="Topics">
                <Select
                    isDisabled={!TOPICS_CONTENT_GRAPH}
                    options={this.props.allTopics}
                    getOptionValue={(topic) => topic.id.toString()}
                    getOptionLabel={(topic) => topic.name}
                    isMulti={true}
                    value={grapher.topicIds.map((topicId) => ({
                        id: topicId,
                        name:
                            this.props.allTopics.find((t) => t.id === topicId)
                                ?.name || "TOPIC NOT FOUND",
                    }))}
                    onChange={(topics) =>
                        runInAction(() => {
                            grapher.topicIds = topics.map((topic) => topic.id)
                        })
                    }
                    menuPlacement="auto"
                />
            </Section>
        )
    }
}
