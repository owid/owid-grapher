import React from "react"
import { observer } from "mobx-react"
import { observable, action } from "mobx"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faDice } from "@fortawesome/free-solid-svg-icons"
import { AdminLayout } from "./AdminLayout.js"
import { BindString } from "./Forms.js"
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer"

import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { match } from "ts-pattern"
import { getWindowUrl } from "@ourworldindata/utils"

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

@observer
export class AiSuggestTool extends React.Component {
    static contextType = AdminAppContext
    context!: AdminAppContextType
    @observable inputText: string = ""
    // @observable configText : string = ""
    @observable outputText: string = ""

    @observable suggestionState: AiTextSuggestionState = {
        state: "AiTextSuggestionStateNotRequested",
    }
    @observable
    prompt: string = `You are a copy writing assistant for Our World In Data.
At OWID we annotate charts with important information. Screen real estate is scarce, so we have to try to be brief while retaining all the important information.
You are presented with examples of text and are tasked with cleaning up the text, making it a bit shorter, easier to read yet informative.`

    @action.bound
    async requestSuggestion(text: string): Promise<void> {
        const { prompt } = this
        const messages = [
            {
                role: "system",
                content: prompt,
            },
            {
                role: "user",
                content: text,
            },
        ]
        this.outputText = ""
        this.suggestionState = { state: "AiTextSuggestionStatePending" }

        const url = "https://api.openai.com/v1/chat/completions"
        const token = this.context.admin.settings.OPENAI_API_KEY
        const org = this.context.admin.settings.OPENAI_ORG_ID
        const model = "gpt-4"
        const temperature = 0.5

        const result = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                "OpenAI-Organization": org,
            } as HeadersInit,
            body: JSON.stringify({
                model,
                temperature,
                messages,
            }),
        }).then((res) => res.json())
        this.suggestionState = {
            state: "AiTextSuggestionStateReceived",
            suggestion: result.choices[0].message.content,
        }
        this.outputText = this.suggestionState.suggestion
    }

    async componentDidMount() {
        const url = getWindowUrl()
        const prompt = url.queryParams.hasOwnProperty("prompt")
            ? url.queryParams["prompt"]
            : undefined
        const input = url.queryParams.hasOwnProperty("input")
            ? url.queryParams["input"]
            : undefined
        if (prompt) {
            this.prompt = prompt
        }
        if (input) {
            this.inputText = input
        }
    }

    getDiffer(inputText: string, outputText: string) {
        return outputText !== "" ? (
            <ReactDiffViewer
                oldValue={inputText}
                newValue={outputText}
                compareMethod={DiffMethod.WORDS}
                styles={{
                    contentText: {
                        wordBreak: "break-word",
                    },
                }}
            />
        ) : (
            <></>
        )
    }

    render() {
        const { inputText, outputText, suggestionState } = this

        const conditionalElements = match(suggestionState)
            .with({ state: "AiTextSuggestionStateNotRequested" }, () => {
                return (
                    <button
                        disabled={inputText === ""}
                        onClick={() => this.requestSuggestion(inputText)}
                    >
                        <FontAwesomeIcon icon={faDice} /> Request AI suggestion
                    </button>
                )
            })

            .with({ state: "AiTextSuggestionStatePending" }, () => {
                return <div>Loading...</div>
            })
            .with({ state: "AiTextSuggestionStateReceived" }, (_state) => {
                return (
                    <>
                        <BindString
                            label="Output text"
                            field="outputText"
                            textarea={true}
                            store={this}
                        />
                        {this.getDiffer(inputText, outputText)}
                        <button
                            onClick={() => this.requestSuggestion(inputText)}
                        >
                            <FontAwesomeIcon icon={faDice} /> Request AI
                            suggestion
                        </button>
                    </>
                )
            })
            .exhaustive()

        return (
            <main className="AiSuggestTool">
                <div className="row">
                    <div className="col">
                        <section>
                            <BindString
                                label="Prompt"
                                field="prompt"
                                textarea={true}
                                store={this}
                            />
                            <BindString
                                label="Input text"
                                field="inputText"
                                textarea={true}
                                store={this}
                            />
                            {conditionalElements}
                        </section>
                    </div>
                </div>
            </main>
        )
    }
}

@observer
export class AiSuggestPage extends React.Component {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    render() {
        return (
            <AdminLayout>
                <AiSuggestTool />
            </AdminLayout>
        )
    }
}
