/**
 * Builds the prompt behind the reference's "Copy prompt" buttons: pasted into
 * an ongoing Claude conversation, it asks Claude to insert the component into
 * the author's doc. The wording deliberately matches the trigger description
 * of the `gdoc-editor` skill (owid-claude-plugins-staff), which handles
 * reading, editing and validating gdocs through the admin API.
 */
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
