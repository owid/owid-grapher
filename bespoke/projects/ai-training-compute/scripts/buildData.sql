-- Regenerates src/data/notableAiModels.json from Epoch AI's "Notable AI models" CSV.
-- Usage (from the project root):
--   curl -sL -o /tmp/notable_ai_models.csv https://epoch.ai/data/notable_ai_models.csv
--   duckdb -c ".read scripts/buildData.sql"
COPY (
    SELECT
        Model AS model,
        Organization AS organization,
        "Organization categorization" AS organizationCategory,
        strftime("Publication date", '%Y-%m-%d') AS date,
        "Training compute (FLOP)" AS trainingComputeFlop,
        -- Epoch's row for GPT-6 Astra has no link yet
        coalesce(Link, CASE WHEN Model = 'GPT-6 Astra'
            THEN 'https://openai.com/index/gpt-6-astra/' END) AS link,
        Domain AS domain,
        Confidence AS confidence
    FROM read_csv_auto('/tmp/notable_ai_models.csv')
    WHERE "Training compute (FLOP)" IS NOT NULL
        AND "Publication date" IS NOT NULL
    ORDER BY "Publication date"
) TO 'src/data/notableAiModels.json' (FORMAT json, ARRAY true);
