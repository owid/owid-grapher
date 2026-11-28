-- Regenerates src/data/modelConfidence.json: Epoch AI's confidence label for
-- each notable model's training compute estimate, keyed by model name.
--
-- The chart takes its data from OWID's "Notable AI models" indicators, which
-- don't include the confidence label yet. Once the ETL adds it as an
-- indicator, the chart can read it from there and this file can go.
--
-- Usage (from the project root):
--   curl -sL -o /tmp/notable_ai_models.csv https://epoch.ai/data/notable_ai_models.csv
--   duckdb -c ".read scripts/buildConfidence.sql"
COPY (
    SELECT Model AS model, Confidence AS confidence
    FROM read_csv_auto('/tmp/notable_ai_models.csv')
    WHERE "Training compute (FLOP)" IS NOT NULL
        AND Confidence IN ('Confident', 'Likely', 'Speculative')
    ORDER BY Model
) TO 'src/data/modelConfidence.json' (FORMAT json, ARRAY true);
