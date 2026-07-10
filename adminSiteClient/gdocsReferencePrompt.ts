/**
 * Builds the prompt behind the reference's "Copy prompt" buttons: pasted into
 * an ongoing Claude conversation, it asks Claude to insert the component into
 * the author's doc. The wording deliberately matches the trigger description
 * of the `gdoc-editor` skill (owid-claude-plugins-staff), which handles
 * reading, editing and validating gdocs through the admin API.
 */
/**
 * The prompt behind the template page's "Copy prompt" button: pasted into a
 * Claude conversation, it asks Claude to scaffold a new Google Doc of this
 * type through the gdoc-editor skill. The skill's create flow already
 * consults the admin's templates.json (front-matter fields, admin-managed
 * properties, a validated example), so the prompt only names the type.
 */
export function buildNewDocPrompt(
    templateId: string,
    templateTitle: string
): string {
    return [
        `Create a new OWID ${templateTitle.toLowerCase()} for me as a Google Doc draft, using the gdoc-editor skill and the admin API.`,
        `Consult the admin's templates.json entry for \`type: ${templateId}\` for the front-matter fields and a validated example — don't invent fields. Ask me about the topic and working title before creating the doc.`,
    ].join("\n\n")
}

export function buildAddComponentPrompt(
    componentId: string,
    archie: string
): string {
    return [
        `Add a {.${componentId}} component to the OWID Google Doc I'm working on, at an appropriate place (ask me if unclear). Use the gdoc-editor skill to read, edit and validate the doc via the admin API.`,
        `The snippet below is an example from the component reference — adapt its values to my doc:`,
        archie,
    ].join("\n\n")
}
