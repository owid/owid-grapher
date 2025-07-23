import { z } from "zod"
import { makeParseableResponseFormat } from "openai/lib/parser"

import type { AutoParseableResponseFormat } from "openai/lib/parser"
import type { ResponseFormatJSONSchema } from "openai/resources"

// Workaround: OpenAI doesn't currently support Zod v4, so we need to use a custom zodResponseFormat function
// see https://github.com/openai/openai-node/issues/1576#issuecomment-3056734414
export function zodResponseFormat<ZodInput extends z.ZodType>(
    zodObject: ZodInput,
    name: string,
    props?: Omit<
        ResponseFormatJSONSchema.JSONSchema,
        "schema" | "strict" | "name"
    >
): AutoParseableResponseFormat<z.infer<ZodInput>> {
    return makeParseableResponseFormat(
        {
            type: "json_schema",
            json_schema: {
                ...props,
                name,
                strict: true,
                schema: z.toJSONSchema(zodObject, { target: "draft-7" }),
            },
        },
        (content) => zodObject.parse(JSON.parse(content))
    )
}
