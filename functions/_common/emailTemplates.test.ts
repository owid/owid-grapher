import { describe, expect, it } from "vitest"
import { renderEmailTemplate } from "./emailTemplates.js"

const TEMPLATE = {
    subject: "Hello {{name}}",
    html: '<p>Hi {{name}}, see <a href="{{url}}">{{url}}</a></p>',
    text: "Hi {{name}}, see {{url}}",
}

describe(renderEmailTemplate, () => {
    it("escapes values in the HTML body but not in the subject or text body", () => {
        const { subject, html, text } = renderEmailTemplate(TEMPLATE, {
            name: "<b>Energy & Health</b>",
            url: "https://example.com/?a=1&b=2",
        })
        expect(subject).toBe("Hello <b>Energy & Health</b>")
        expect(html).toBe(
            '<p>Hi &lt;b&gt;Energy &amp; Health&lt;/b&gt;, see <a href="https://example.com/?a=1&amp;b=2">https://example.com/?a=1&amp;b=2</a></p>'
        )
        expect(text).toBe(
            "Hi <b>Energy & Health</b>, see https://example.com/?a=1&b=2"
        )
    })

    it("refuses to send a template with an unfilled placeholder", () => {
        expect(() => renderEmailTemplate(TEMPLATE, { name: "x" })).toThrow(
            "{{url}}"
        )
    })
})
