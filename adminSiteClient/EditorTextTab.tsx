import { faMinus } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { LogoOption } from "@ourworldindata/types"
import { getErrorMessageRelatedQuestionUrl } from "@ourworldindata/grapher"
import { slugify } from "@ourworldindata/utils"
import { action, computed } from "mobx"
import { observer } from "mobx-react"
import React from "react"
import { isChartEditorInstance } from "./ChartEditor.js"
import {
    AutoTextField,
    BindAutoStringExt,
    BindString,
    Button,
    RadioGroup,
    Section,
    TextField,
    Toggle,
} from "./Forms.js"
import { AbstractChartEditor } from "./AbstractChartEditor.js"
import { ErrorMessages } from "./ChartEditorTypes.js"

@observer
export class EditorTextTab<
    Editor extends AbstractChartEditor,
> extends React.Component<{ editor: Editor; errorMessages: ErrorMessages }> {
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
        return this.props.errorMessages
    }

    @computed get showAnyAnnotationFieldInTitleToggle() {
        const { features } = this.props.editor
        return (
            features.showEntityAnnotationInTitleToggle ||
            features.showTimeAnnotationInTitleToggle ||
            features.showChangeInPrefixToggle
        )
    }

    render() {
        const { editor } = this.props
        const { grapher, features } = editor

        return (
            <div className="EditorTextTab">
                <Section name="Header">
                    <BindAutoStringExt
                        label="Title"
                        readFn={(grapher) => grapher.displayTitle}
                        writeFn={(grapher, newVal) => (grapher.title = newVal)}
                        auto={
                            editor.couldPropertyBeInherited("title")
                                ? editor.activeParentConfig!.title
                                : undefined
                        }
                        isAuto={
                            editor.isPropertyInherited("title") ||
                            grapher.title === undefined
                        }
                        store={grapher}
                        softCharacterLimit={100}
                    />
                    {features.showEntityAnnotationInTitleToggle && (
                        <Toggle
                            label="Hide automatic entity"
                            value={
                                !!grapher.hideAnnotationFieldsInTitle?.entity
                            }
                            onValue={this.onToggleTitleAnnotationEntity}
                        />
                    )}
                    {features.showTimeAnnotationInTitleToggle && (
                        <Toggle
                            label="Hide automatic time"
                            secondaryLabel={
                                "Grapher makes sure to include the current time in the title if " +
                                "omitting it would lead to SVG exports with no reference " +
                                "to the time. In such cases, your preference is ignored."
                            }
                            value={!!grapher.hideAnnotationFieldsInTitle?.time}
                            onValue={this.onToggleTitleAnnotationTime}
                        />
                    )}
                    {features.showChangeInPrefixToggle && (
                        <Toggle
                            label="Don't prepend 'Change in' in relative line charts"
                            value={
                                !!grapher.hideAnnotationFieldsInTitle
                                    ?.changeInPrefix
                            }
                            onValue={this.onToggleTitleAnnotationChangeInPrefix}
                        />
                    )}
                    {this.showAnyAnnotationFieldInTitleToggle && <hr />}
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
                    <BindAutoStringExt
                        label="Subtitle"
                        readFn={(grapher) => grapher.currentSubtitle}
                        writeFn={(grapher, newVal) =>
                            (grapher.subtitle = newVal)
                        }
                        auto={
                            editor.couldPropertyBeInherited("subtitle")
                                ? editor.activeParentConfig!.subtitle
                                : undefined
                        }
                        isAuto={
                            editor.isPropertyInherited("subtitle") ||
                            grapher.subtitle === undefined
                        }
                        store={grapher}
                        placeholder="Briefly describe the context of the data. It's best to avoid duplicating any information which can be easily inferred from other visual elements of the chart."
                        textarea
                        softCharacterLimit={280}
                        errorMessage={this.errorMessages.subtitle}
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
                    <BindAutoStringExt
                        label="Source"
                        readFn={(grapher) => grapher.sourcesLine}
                        writeFn={(grapher, newVal) =>
                            (grapher.sourceDesc = newVal)
                        }
                        auto={
                            editor.couldPropertyBeInherited("sourceDesc")
                                ? editor.activeParentConfig!.sourceDesc
                                : undefined
                        }
                        isAuto={
                            editor.isPropertyInherited("sourceDesc") ||
                            grapher.sourceDesc === undefined
                        }
                        store={grapher}
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
                    {isChartEditorInstance(editor) &&
                        editor.references &&
                        (editor.references.postsWordpress.length > 0 ||
                            editor.references.postsGdocs.length > 0) && (
                            <div className="originSuggestions">
                                <p>Origin url suggestions</p>
                                <ul>
                                    {[
                                        ...editor.references.postsWordpress,
                                        ...editor.references.postsGdocs,
                                    ].map((post) => (
                                        <li key={post.id}>{post.url}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                    <BindAutoStringExt
                        label="Footer note"
                        readFn={(grapher) => grapher.note ?? ""}
                        writeFn={(grapher, newVal) => (grapher.note = newVal)}
                        auto={
                            editor.couldPropertyBeInherited("note")
                                ? editor.activeParentConfig?.note
                                : undefined
                        }
                        isAuto={editor.isPropertyInherited("note")}
                        store={grapher}
                        helpText="Any important clarification needed to avoid miscommunication"
                        softCharacterLimit={140}
                        errorMessage={this.errorMessages.note}
                        textarea
                    />
                </Section>

                <Section name="Related">
                    <div>
                        <TextField
                            label="Related question"
                            value={grapher.relatedQuestion?.text}
                            onValue={action((value: string) => {
                                if (grapher.relatedQuestion) {
                                    grapher.relatedQuestion.text = value
                                } else {
                                    grapher.relatedQuestion = {
                                        text: value,
                                        url: "",
                                    }
                                }
                            })}
                            placeholder="e.g. How did countries respond to the pandemic?"
                            helpText="Short question promoting exploration of related content"
                            softCharacterLimit={50}
                        />
                        {grapher.relatedQuestion?.text && (
                            <TextField
                                label="URL"
                                value={grapher.relatedQuestion.url}
                                onValue={action((value: string) => {
                                    grapher.relatedQuestion!.url = value
                                })}
                                placeholder="e.g. https://ourworldindata.org/coronavirus"
                                helpText="Page or section of a page where the answer to the previous question can be found."
                                errorMessage={getErrorMessageRelatedQuestionUrl(
                                    grapher.relatedQuestion
                                )}
                            />
                        )}
                        {grapher.relatedQuestion?.text && (
                            <Button
                                onClick={() =>
                                    (grapher.relatedQuestion = undefined)
                                }
                            >
                                <FontAwesomeIcon icon={faMinus} /> Remove
                                related question
                            </Button>
                        )}
                    </div>
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
