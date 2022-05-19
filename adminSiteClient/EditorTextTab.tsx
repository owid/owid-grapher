import React from "react"
import { action, computed, runInAction } from "mobx"
import { observer } from "mobx-react"
import { ChartEditor } from "./ChartEditor.js"
import {
    Toggle,
    Section,
    BindString,
    BindAutoString,
    AutoTextField,
    RadioGroup,
    TextField,
    Button,
} from "./Forms.js"
import { LogoOption } from "../grapher/captionedChart/Logos.js"
import slugify from "slugify"
import {
    RelatedQuestionsConfig,
    Topic,
} from "../grapher/core/GrapherConstants.js"
import {
    getErrorMessageRelatedQuestionUrl,
    Grapher,
} from "../grapher/core/Grapher.js" // fix.
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faPlus } from "@fortawesome/free-solid-svg-icons/faPlus.js"
import { faMinus } from "@fortawesome/free-solid-svg-icons/faMinus.js"
import { faSync } from "@fortawesome/free-solid-svg-icons/faSync"
import Select from "react-select"
import { TOPICS_CONTENT_GRAPH } from "../settings/clientSettings.js"

const getTopicName = (topicId: number, allTopics: Topic[]): string => {
    return allTopics.find((t) => t.id === topicId)?.name || ""
}

const getTopicUrl = (topicId: number, allTopics: Topic[]): string => {
    return allTopics.find((t) => t.id === topicId)?.url || ""
}

@observer
export class EditorTextTab extends React.Component<{ editor: ChartEditor }> {
    @action.bound onSlug(slug: string) {
        this.props.editor.grapher.slug = slugify(slug).toLowerCase()
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

    @computed get isOriginUrlInSyncWithTopics() {
        const { grapher } = this.props.editor
        return (
            grapher.originUrl ===
            getTopicUrl(grapher?.topicIds?.[0], this.props.editor.allTopics)
        )
    }

    @action.bound syncOriginUrlWithTopics() {
        const { grapher } = this.props.editor
        grapher.originUrl = getTopicUrl(
            grapher?.topicIds?.[0],
            this.props.editor.allTopics
        )
    }

    render() {
        const { grapher, references } = this.props.editor
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
                        label="Hide automatic time/entity"
                        value={!!grapher.hideTitleAnnotation}
                        onValue={action(
                            (value: boolean) =>
                                (grapher.hideTitleAnnotation =
                                    value || undefined)
                        )}
                    />
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
                    <AutoTextField
                        label="Origin url"
                        value={grapher.originUrl}
                        onValue={(value) =>
                            runInAction(() => {
                                grapher.originUrl = value
                            })
                        }
                        isAuto={this.isOriginUrlInSyncWithTopics}
                        onToggleAuto={this.syncOriginUrlWithTopics}
                        helpText="Human-friendly URL for this chart"
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
                    />
                </Section>

                <TopicsSection
                    allTopics={this.props.editor.allTopics}
                    grapher={grapher}
                    isOriginUrlInSyncWithTopics={
                        this.isOriginUrlInSyncWithTopics
                    }
                    syncOriginUrlWithTopics={this.syncOriginUrlWithTopics}
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
                        placeholder="e.g. IHME data"
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
    isOriginUrlInSyncWithTopics: boolean
    syncOriginUrlWithTopics: () => void
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
                        name: getTopicName(topicId, this.props.allTopics),
                    }))}
                    onChange={(topics) =>
                        runInAction(() => {
                            grapher.topicIds = topics.map((topic) => topic.id)
                            // Keep originUrl in sync with the first topic if it
                            // currently is. Otherwise, consider it has been
                            // overriden and leave it as-is.
                            if (this.props.isOriginUrlInSyncWithTopics) {
                                this.props.syncOriginUrlWithTopics()
                            }
                        })
                    }
                    menuPlacement="auto"
                />
                {!this.props.isOriginUrlInSyncWithTopics && (
                    <p className="alert alert-warning d-flex justify-content-between align-items-center mt-2">
                        The origin URL is out of sync with the first topic.{" "}
                        <button
                            className="btn btn-warning"
                            onClick={this.props.syncOriginUrlWithTopics}
                        >
                            <FontAwesomeIcon icon={faSync} /> Sync
                        </button>
                    </p>
                )}
            </Section>
        )
    }
}
