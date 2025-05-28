import ollama from "ollama"
import { z } from "zod"
import { zodToJsonSchema } from "zod-to-json-schema"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"

/*
    Ollama with structured outputs
    From: https://github.com/ollama/ollama-js/blob/main/examples/structured_outputs/structured-outputs-image.ts
*/

const SearchSuggestionsSchema = z.object({
    charts: z.array(
        z.object({
            title: z.string(),
            suggestion: z.string(),
        })
    ),
})

interface ExtractSearchSuggestionsArgs {
    model: string
    titles?: string[]
    batch?: boolean
}

const OLLAMA_DEFAULT_MODEL = "gemma3:4b"

/**
 * Generate search suggestions for multiple chart titles
 * Each title will have exactly one search suggestion
 */
export const extractSearchSuggestions = async (
    titles: string[],
    model: string = OLLAMA_DEFAULT_MODEL
): Promise<Map<string, string>> => {
    try {
        if (titles.length === 0) return new Map()

        const jsonSchema = zodToJsonSchema(SearchSuggestionsSchema)

        const titlesJson = titles.map((title) => `"${title}"`).join(",\n")

        const messages = [
            {
                role: "user",
                content: `You are a data cleaning assistant. Your task is to extract the most semantically meaningful search keywords from a list of chart titles. The goal is to retain a maximum of 4 words per title.

Instructions:
1. Use only words that appear in the original title.
2. Do not include any numbers, years, or country names.
3. Keep only the most distinctive and meaningful terms.
4. Do not add synonyms or inferred meanings.
5. Maintain the original word form from the chart titles.
6. Remove stopwords (e.g. "of", "in", "the", "a", "to", etc.).
7. Your output should follow the json schema provided.

For each of the following chart titles, generate exactly 1 search suggestion containing the most important terms (maximum 4 words):
[${titlesJson}]`,
            },
        ]

        const response = await ollama.chat({
            model,
            messages,
            format: jsonSchema,
            options: {
                temperature: 0, // Make responses more deterministic
            },
        })

        // Parse and validate the batch response
        const parsedSuggestions = SearchSuggestionsSchema.parse(
            JSON.parse(response.message.content)
        )

        return new Map<string, string>(
            parsedSuggestions.charts.map((item) => [
                item.title,
                item.suggestion.toLowerCase(),
            ])
        )
    } catch (error) {
        console.error("Error processing chart(s):", error)
        return new Map()
    }
}

export const processSequentially = async (
    model: string,
    titles: string[]
): Promise<Map<string, string>> => {
    const results = new Map<string, string>()

    for (const title of titles) {
        // Process one title at a time
        const result = await extractSearchSuggestions([title], model)
        // Since we're only processing one title, there will be only one entry
        const [[_, suggestion]] = result.entries()

        console.log(`Processed title: "${title}" → "${suggestion}"`)
        results.set(title, suggestion)
    }

    return results
}

const handleExtractSearchSuggestions = async ({
    model,
    titles = [],
    batch = false,
}: ExtractSearchSuggestionsArgs) => {
    try {
        console.log(
            `Processing ${titles.length} titles in ${batch ? "batch" : "sequential"} mode...`
        )

        const startTime = performance.now()
        let suggestionMap: Map<string, string>

        if (batch) {
            suggestionMap = await extractSearchSuggestions(titles, model)
        } else {
            suggestionMap = await processSequentially(model, titles)
        }

        const endTime = performance.now()
        const duration = (endTime - startTime) / 1000 // Convert to seconds

        console.log("\nSearch Suggestions:")
        console.log("------------------")
        for (const [title, suggestion] of suggestionMap.entries()) {
            console.log(`"${title}" → "${suggestion}"`)
        }

        console.log("\nPerformance:")
        console.log("------------------")
        console.log(`Model: ${model}`)
        console.log(`Mode: ${batch ? "Batch" : "Sequential"}`)
        console.log(`Total time: ${duration.toFixed(2)} seconds`)
        console.log(
            `Average time per title: ${(duration / titles.length).toFixed(2)} seconds`
        )
    } catch (error) {
        console.error("Error:", error)
        process.exit(1)
    }
}

/*
Extract search suggestions for chart titles using the LLM.

Usage:
$ yarn extractSearchSuggestions --help

Examples:
  yarn extractSearchSuggestions "Global CO2 emissions" "Life expectancy vs GDP"
  yarn extractSearchSuggestions --model gemma3:4b "Global population growth" "Annual CO2 emissions"
  yarn extractSearchSuggestions --batch "Global CO2 emissions" "Life expectancy vs GDP"
*/

// Run CLI when this script is executed directly
if (require.main === module) {
    void yargs(hideBin(process.argv))
        .command<ExtractSearchSuggestionsArgs>(
            "$0 [titles..]",
            "Extract search suggestions from chart titles",
            (yargs) => {
                yargs
                    .positional("titles", {
                        type: "string",
                        describe: "Chart titles to process",
                        demandOption: true,
                    })
                    .option("model", {
                        alias: "m",
                        type: "string",
                        description: "OLLAMA model to use",
                        default: OLLAMA_DEFAULT_MODEL,
                    })
                    .option("batch", {
                        alias: "b",
                        type: "boolean",
                        description:
                            "Process titles in batch mode instead of sequentially",
                        default: false,
                    })
                    .check((argv) => {
                        if (!argv.titles || argv.titles.length === 0) {
                            throw new Error(
                                "At least one title must be provided"
                            )
                        }
                        return true
                    })
            },
            async (argv) => {
                await handleExtractSearchSuggestions(argv)
            }
        )
        .help()
        .alias("help", "h")
        .strict().argv
}
