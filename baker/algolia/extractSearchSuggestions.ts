import ollama from "ollama"
import { z } from "zod"
import { zodToJsonSchema } from "zod-to-json-schema"

/*
    Ollama vision capabilities with structured outputs
    From: https://github.com/ollama/ollama-js/blob/main/examples/structured_outputs/structured-outputs-image.ts
*/

const SearchSuggestionsSchema = z.object({
    search_suggestions: z.array(z.string()).length(5),
})

/**
 * Generate search suggestions from a chart title
 */
export const extractSearchSuggestions = async (
    model: string,
    title: string
): Promise<string[]> => {
    try {
        // Convert the Zod schema to JSON Schema format
        const jsonSchema = zodToJsonSchema(SearchSuggestionsSchema)

        const messages = [
            {
                role: "user",
                content: `
                    For the chart "${title}", Generate a JSON output containing exactly 5 search suggestions that a user might type into a search engine when looking for information related to this chart. The suggestions should be short, natural, and reflect how people actually search online. Avoid long sentences—keep each query concise and to the point. Use common and likely synonyms to reflect the diversity of search patterns.`,
            },
        ]

        const response = await ollama.chat({
            model: model,
            messages: messages,
            format: jsonSchema,
            options: {
                temperature: 0, // Make responses more deterministic
            },
        })

        // Parse and validate the response
        const parsedSearchSuggestions = SearchSuggestionsSchema.parse(
            JSON.parse(response.message.content)
        )
        return parsedSearchSuggestions.search_suggestions || []
    } catch (error) {
        console.error("Error processing chart:", error)
        return []
    }
}
