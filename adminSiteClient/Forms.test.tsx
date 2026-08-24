/**
 * @vitest-environment happy-dom
 */

/**
 * Behavioural coverage for the shared admin form kit. These specs deliberately
 * avoid asserting on markup or class names: they exist so the internals can be
 * swapped (Bootstrap markup -> antd primitives) without silently changing what
 * the 46 call sites depend on — `value`/`onValue` plumbing, trim-on-blur, the
 * intermediately-unparsable number states, and the `Bind*` two-way binding.
 */

import * as React from "react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { observable } from "mobx"
import {
    BindAutoString,
    BindFloat,
    BindString,
    NumberField,
    RadioGroup,
    SelectField,
    TextField,
    Toggle,
} from "./Forms.js"

function noop(): void {
    return undefined
}

type TextFieldProps = React.ComponentProps<typeof TextField>
type NumberFieldProps = React.ComponentProps<typeof NumberField>

function ControlledTextField({
    initialValue = "",
    onValue,
    ...rest
}: Omit<TextFieldProps, "value" | "onValue"> & {
    initialValue?: string
    onValue?: (value: string) => void
}) {
    const [value, setValue] = useState(initialValue)
    return (
        <TextField
            {...rest}
            value={value}
            onValue={(next) => {
                setValue(next)
                onValue?.(next)
            }}
        />
    )
}

function ControlledNumberField({
    initialValue,
    onValue,
    ...rest
}: Omit<NumberFieldProps, "value" | "onValue"> & {
    initialValue?: number
    onValue?: (value: number | undefined) => void
}) {
    const [value, setValue] = useState<number | undefined>(initialValue)
    return (
        <NumberField
            {...rest}
            value={value}
            onValue={(next) => {
                setValue(next)
                onValue?.(next)
            }}
        />
    )
}

function getTextbox(): HTMLInputElement {
    return screen.getByRole("textbox") as HTMLInputElement
}

/**
 * `Toggle` renders a native checkbox today and an antd `Switch`
 * (`role="switch"`) once migrated, so accept either.
 */
function getToggle(): HTMLElement {
    return screen.queryByRole("checkbox") ?? screen.getByRole("switch")
}

function isToggleOn(element: HTMLElement): boolean {
    if (element instanceof HTMLInputElement) return element.checked
    return element.getAttribute("aria-checked") === "true"
}

/**
 * `SelectField` renders a native `<select>` today and an antd `Select` once
 * migrated; both expose the `combobox` role, but only one of them can be
 * driven with a `change` event.
 */
function getSelect(): HTMLElement {
    return screen.queryByRole("combobox") ?? screen.getByRole("listbox")
}

function chooseOption(select: HTMLElement, value: string, label: string) {
    if (select instanceof HTMLSelectElement) {
        fireEvent.change(select, { target: { value } })
    } else {
        fireEvent.mouseDown(select)
        fireEvent.click(screen.getByTitle(label))
    }
}

describe(TextField, () => {
    it("round-trips its value and reports every keystroke", () => {
        const onValue = vi.fn()
        render(<ControlledTextField initialValue="hello" onValue={onValue} />)

        const input = getTextbox()
        expect(input).toHaveValue("hello")

        fireEvent.change(input, { target: { value: "hello world" } })

        expect(onValue).toHaveBeenCalledWith("hello world")
        expect(input).toHaveValue("hello world")
    })

    it("leaves whitespace alone while typing but trims it on blur", () => {
        const onValue = vi.fn()
        render(<ControlledTextField onValue={onValue} />)

        const input = getTextbox()
        fireEvent.change(input, { target: { value: "  padded  " } })
        expect(onValue).toHaveBeenLastCalledWith("  padded  ")
        expect(input).toHaveValue("  padded  ")

        fireEvent.blur(input)
        expect(onValue).toHaveBeenLastCalledWith("padded")
        expect(input).toHaveValue("padded")
    })

    it("forwards blur to the consumer's own onBlur handler", () => {
        const onBlur = vi.fn()
        render(<ControlledTextField initialValue="a" onBlur={onBlur} />)

        fireEvent.blur(getTextbox())

        expect(onBlur).toHaveBeenCalledOnce()
    })

    it("calls onEnter and onEscape for those keys only", () => {
        const onEnter = vi.fn()
        const onEscape = vi.fn()
        render(<ControlledTextField onEnter={onEnter} onEscape={onEscape} />)

        const input = getTextbox()
        fireEvent.keyDown(input, { key: "a" })
        expect(onEnter).not.toHaveBeenCalled()
        expect(onEscape).not.toHaveBeenCalled()

        fireEvent.keyDown(input, { key: "Enter" })
        expect(onEnter).toHaveBeenCalledOnce()
        expect(onEscape).not.toHaveBeenCalled()

        fireEvent.keyDown(input, { key: "Escape" })
        expect(onEscape).toHaveBeenCalledOnce()
    })

    it("renders label, help text and placeholder", () => {
        render(
            <ControlledTextField
                label="Chart title"
                helpText="Shown above the chart"
                placeholder="Type a title"
            />
        )

        expect(screen.getByText("Chart title")).toBeInTheDocument()
        expect(screen.getByText("Shown above the chart")).toBeInTheDocument()
        expect(screen.getByPlaceholderText("Type a title")).toBeInTheDocument()
    })

    it("can be disabled", () => {
        render(<ControlledTextField initialValue="x" disabled />)
        expect(getTextbox()).toBeDisabled()
    })

    it("shows the soft character limit only once there is a value", () => {
        const { rerender } = render(
            <TextField value="" onValue={noop} softCharacterLimit={5} />
        )
        expect(screen.queryByText("0 / 5")).not.toBeInTheDocument()

        rerender(<TextField value="ab" onValue={noop} softCharacterLimit={5} />)
        expect(screen.getByText("2 / 5")).toBeInTheDocument()

        rerender(
            <TextField value="abcdef" onValue={noop} softCharacterLimit={5} />
        )
        expect(screen.getByText(/^6 \/ 5/)).toBeInTheDocument()
        expect(
            screen.getByText(/may cause rendering issues/)
        ).toBeInTheDocument()
    })

    it("renders an error message when given one", () => {
        render(<ControlledTextField errorMessage="Something is wrong" />)
        expect(screen.getByText("Something is wrong")).toBeInTheDocument()
    })

    it("renders a button that reports clicks and can be disabled", () => {
        const onButtonClick = vi.fn()
        const { rerender } = render(
            <TextField
                value="x"
                onValue={noop}
                buttonContent="Go"
                onButtonClick={onButtonClick}
            />
        )

        const button = screen.getByRole("button", { name: "Go" })
        expect(button).not.toBeDisabled()
        fireEvent.click(button)
        expect(onButtonClick).toHaveBeenCalledOnce()

        rerender(
            <TextField
                value="x"
                onValue={noop}
                buttonContent="Go"
                onButtonClick={onButtonClick}
                buttonDisabled
            />
        )
        expect(screen.getByRole("button", { name: "Go" })).toBeDisabled()
    })

    it("renders no button when there is no button content", () => {
        render(<ControlledTextField initialValue="x" />)
        expect(screen.queryByRole("button")).not.toBeInTheDocument()
    })
})

describe(NumberField, () => {
    it("round-trips numbers", () => {
        const onValue = vi.fn()
        render(
            <ControlledNumberField
                initialValue={42}
                onValue={onValue}
                allowDecimal
                allowNegative
            />
        )

        const input = getTextbox()
        expect(input).toHaveValue("42")

        fireEvent.change(input, { target: { value: "43" } })
        expect(onValue).toHaveBeenLastCalledWith(43)
        expect(input).toHaveValue("43")
    })

    it("keeps intermediately unparsable input editable without emitting NaN", () => {
        const onValue = vi.fn()
        render(
            <ControlledNumberField
                onValue={onValue}
                allowDecimal
                allowNegative
            />
        )
        const input = getTextbox()

        // A lone minus sign: the user is halfway through typing a negative
        // number, so the field has no value yet but must keep the "-".
        fireEvent.change(input, { target: { value: "-" } })
        expect(onValue).toHaveBeenLastCalledWith(undefined)
        expect(input).toHaveValue("-")

        fireEvent.change(input, { target: { value: "-1" } })
        expect(onValue).toHaveBeenLastCalledWith(-1)
        expect(input).toHaveValue("-1")

        // A trailing decimal point: the value is already 1, but the "." has to
        // survive so the user can type "1.5".
        fireEvent.change(input, { target: { value: "1." } })
        expect(onValue).toHaveBeenLastCalledWith(1)
        expect(input).toHaveValue("1.")

        fireEvent.change(input, { target: { value: "1.5" } })
        expect(onValue).toHaveBeenLastCalledWith(1.5)
        expect(input).toHaveValue("1.5")

        // Clearing the field means "no value", not NaN.
        fireEvent.change(input, { target: { value: "" } })
        expect(onValue).toHaveBeenLastCalledWith(undefined)
        expect(input).toHaveValue("")

        for (const [value] of onValue.mock.calls)
            expect(value === undefined || !isNaN(value)).toBe(true)
    })

    it("drops the intermediate input state on blur", () => {
        render(<ControlledNumberField allowDecimal allowNegative />)
        const input = getTextbox()

        fireEvent.change(input, { target: { value: "1." } })
        expect(input).toHaveValue("1.")

        fireEvent.blur(input)
        expect(input).toHaveValue("1")
    })

    it("rejects characters the field does not allow", () => {
        const onValue = vi.fn()
        render(<ControlledNumberField initialValue={1} onValue={onValue} />)
        const input = getTextbox()

        // Neither decimals nor negative numbers are allowed here.
        fireEvent.change(input, { target: { value: "1.5" } })
        fireEvent.change(input, { target: { value: "-1" } })
        fireEvent.change(input, { target: { value: "abc" } })

        expect(onValue).not.toHaveBeenCalled()
        expect(input).toHaveValue("1")

        fireEvent.change(input, { target: { value: "12" } })
        expect(onValue).toHaveBeenLastCalledWith(12)
    })

    it("renders a reset button alongside the field", () => {
        const onClick = vi.fn()
        render(
            <ControlledNumberField
                initialValue={1}
                allowDecimal
                resetButton={{ onClick, content: "Reset me" }}
            />
        )

        const button = screen.getByRole("button", { name: "Reset me" })
        fireEvent.click(button)
        expect(onClick).toHaveBeenCalledOnce()
        expect(getTextbox()).toHaveValue("1")
    })
})

describe(SelectField, () => {
    const options = [
        { value: "a", label: "Option A" },
        { value: "b", label: "Option B" },
    ]

    it("shows the selected option and reports changes", () => {
        const onValue = vi.fn()
        render(
            <SelectField
                label="Pick one"
                value="a"
                options={options}
                onValue={onValue}
            />
        )

        expect(screen.getByText("Pick one")).toBeInTheDocument()
        expect(screen.getByText("Option A")).toBeInTheDocument()

        chooseOption(getSelect(), "b", "Option B")
        expect(onValue).toHaveBeenCalledWith("b")
    })
})

describe(RadioGroup, () => {
    const options = [
        { value: "linear", label: "Linear" },
        { value: "log", label: "Logarithmic" },
    ]

    it("marks the selected option and reports changes", () => {
        const onChange = vi.fn()
        render(
            <RadioGroup
                label="Axis scale"
                options={options}
                value="linear"
                onChange={onChange}
            />
        )

        expect(screen.getByRole("radio", { name: "Linear" })).toBeChecked()
        const log = screen.getByRole("radio", { name: "Logarithmic" })
        expect(log).not.toBeChecked()

        fireEvent.click(log)
        expect(onChange).toHaveBeenCalledWith("log")
    })
})

describe(Toggle, () => {
    it("reflects its value and reports the flipped one", () => {
        const onValue = vi.fn()
        const { rerender } = render(
            <Toggle label="Hide legend" value={false} onValue={onValue} />
        )

        expect(screen.getByText("Hide legend")).toBeInTheDocument()
        const toggle = getToggle()
        expect(isToggleOn(toggle)).toBe(false)

        fireEvent.click(toggle)
        expect(onValue).toHaveBeenCalledWith(true)

        rerender(<Toggle label="Hide legend" value={true} onValue={onValue} />)
        expect(isToggleOn(getToggle())).toBe(true)

        fireEvent.click(getToggle())
        expect(onValue).toHaveBeenLastCalledWith(false)
    })

    it("can be disabled", () => {
        const onValue = vi.fn()
        render(
            <Toggle
                label="Hide legend"
                value={false}
                onValue={onValue}
                disabled
            />
        )

        fireEvent.click(getToggle())
        expect(onValue).not.toHaveBeenCalled()
    })
})

describe(BindString, () => {
    it("binds an observable field in both directions", () => {
        const store = observable({ title: "Life expectancy" })
        render(<BindString field="title" store={store} />)

        const input = getTextbox()
        expect(input).toHaveValue("Life expectancy")

        fireEvent.change(input, { target: { value: "  Child mortality  " } })
        expect(store.title).toBe("  Child mortality  ")

        fireEvent.blur(input)
        expect(store.title).toBe("Child mortality")
        expect(getTextbox()).toHaveValue("Child mortality")
    })

    it("defaults the label to the capitalised field name", () => {
        const store = observable({ subtitle: "" })
        render(<BindString field="subtitle" store={store} />)
        expect(screen.getByText("Subtitle")).toBeInTheDocument()
    })

    it("renders a textarea when asked to", () => {
        const store = observable({ note: "hello" })
        render(<BindString field="note" store={store} textarea />)

        const textarea = screen.getByRole("textbox")
        expect(textarea.tagName).toBe("TEXTAREA")
        expect(textarea).toHaveValue("hello")

        fireEvent.change(textarea, { target: { value: "  bye  " } })
        expect(store.note).toBe("  bye  ")
        fireEvent.blur(textarea)
        expect(store.note).toBe("bye")
    })
})

describe(BindFloat, () => {
    it("binds a numeric field, tolerating intermediate input", () => {
        const store: { someNumber: number | undefined } = observable({
            someNumber: 5,
        })
        render(<BindFloat field="someNumber" store={store} />)

        const input = getTextbox()
        expect(input).toHaveValue("5")

        fireEvent.change(input, { target: { value: "-" } })
        expect(store.someNumber).toBeUndefined()
        expect(input).toHaveValue("-")

        fireEvent.change(input, { target: { value: "-3.5" } })
        expect(store.someNumber).toBe(-3.5)
        expect(input).toHaveValue("-3.5")
    })
})

describe(BindAutoString, () => {
    it("shows the automatic value until the field is overridden", () => {
        const store: { subtitle: string | undefined } = observable({
            subtitle: undefined,
        })
        render(
            <BindAutoString
                field="subtitle"
                store={store}
                auto="Automatic subtitle"
            />
        )

        const input = getTextbox()
        expect(input).toHaveValue("Automatic subtitle")
        // While automatic, the link/unlink button is inert — you override the
        // value by editing the field, not by clicking the button.
        expect(screen.getByRole("button")).toBeDisabled()

        fireEvent.change(input, { target: { value: "Manual subtitle" } })
        expect(store.subtitle).toBe("Manual subtitle")
        expect(getTextbox()).toHaveValue("Manual subtitle")
        expect(screen.getByRole("button")).not.toBeDisabled()
    })

    it("resets back to the automatic value when the button is clicked", () => {
        const store: { subtitle: string | undefined } = observable({
            subtitle: "Manual subtitle",
        })
        render(
            <BindAutoString
                field="subtitle"
                store={store}
                auto="Automatic subtitle"
            />
        )

        fireEvent.click(screen.getByRole("button"))

        expect(store.subtitle).toBeUndefined()
        expect(getTextbox()).toHaveValue("Automatic subtitle")
    })

    it("trims the overridden value on blur", () => {
        const store: { subtitle: string | undefined } = observable({
            subtitle: undefined,
        })
        render(<BindAutoString field="subtitle" store={store} auto="Auto" />)

        const input = getTextbox()
        fireEvent.change(input, { target: { value: "  spaced  " } })
        fireEvent.blur(input)

        expect(store.subtitle).toBe("spaced")
    })
})
