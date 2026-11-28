-- Regenerates the bundled data files from Epoch AI's published datasets.
-- Usage (from the project root):
--   curl -sL -o /tmp/notable_ai_models.csv https://epoch.ai/data/notable_ai_models.csv
--   curl -sL -o /tmp/all_ai_models.csv https://epoch.ai/data/all_ai_models.csv
--   curl -sL -o /tmp/benchmark_data.zip https://epoch.ai/data/benchmark_data.zip
--   unzip -o -d /tmp/benchmark_data /tmp/benchmark_data.zip
--   duckdb -c ".read scripts/buildData.sql"

-- The notable-models file lacks some columns (the estimation method), so
-- the rows come from the all-models file, which covers every notable model
CREATE TEMP TABLE all_models AS
SELECT
    Model AS model,
    Organization AS organization,
    "Organization categorization" AS organizationCategory,
    "Publication date" AS publicationDate,
    "Training compute (FLOP)" AS trainingComputeFlop,
    "Training compute estimation method" AS computeEstimationMethod,
    Link AS link,
    Domain AS domain,
    Confidence AS confidence
FROM read_csv_auto('/tmp/all_ai_models.csv')
WHERE "Training compute (FLOP)" IS NOT NULL
    AND "Publication date" IS NOT NULL;

CREATE TEMP TABLE notable AS
SELECT Model AS model FROM read_csv_auto('/tmp/notable_ai_models.csv');

-- Each model's rank by training compute among all models released on or
-- before the same day: 1 means it was the largest yet. Epoch's own
-- "frontier models" are those ranked 5 or better; we compute the rank
-- ourselves so the chart can offer other cut-offs
CREATE TEMP TABLE ranked AS
SELECT
    a.*,
    1 + (
        SELECT count(*) FROM all_models b
        WHERE b.publicationDate <= a.publicationDate
            AND b.trainingComputeFlop > a.trainingComputeFlop
    ) AS rankAtRelease
FROM all_models a;

-- The largest cut-off the chart offers
CREATE TEMP TABLE settings AS SELECT 7 AS maxRank;

-- Models that are notable or among the 7 largest at their release: the
-- scatter shows either the notable ones or those within a chosen rank
COPY (
    SELECT
        r.model,
        r.organization,
        r.organizationCategory,
        strftime(r.publicationDate, '%Y-%m-%d') AS date,
        r.trainingComputeFlop,
        r.computeEstimationMethod,
        -- Epoch's row for GPT-6 Astra has no link yet
        coalesce(r.link, CASE WHEN r.model = 'GPT-6 Astra'
            THEN 'https://openai.com/index/gpt-6-astra/' END) AS link,
        r.domain,
        r.confidence,
        r.model IN (SELECT model FROM notable) AS isNotable,
        r.rankAtRelease
    FROM ranked r
    WHERE r.model IN (SELECT model FROM notable)
        OR r.rankAtRelease <= (SELECT maxRank FROM settings)
    ORDER BY r.publicationDate, r.model
) TO 'src/data/aiModels.json' (FORMAT json, ARRAY true);

-- Epoch Capabilities Index scores, with each model's compute estimate (if
-- any), for the strip of frontier models missing from the scatter
COPY (
    SELECT
        e.Model AS model,
        e."Display name" AS displayName,
        e.Organization AS organization,
        strftime(e.date, '%Y-%m-%d') AS date,
        round(e.eci, 2) AS eci,
        round(e.eci_ci_low, 2) AS eciLow,
        round(e.eci_ci_high, 2) AS eciHigh,
        a.trainingComputeFlop,
        a.computeEstimationMethod
    FROM read_csv_auto(
        '/tmp/benchmark_data/epoch_capabilities_index/eci_scores.csv'
    ) e
    LEFT JOIN all_models a ON a.model = e.Model
    WHERE e.eci IS NOT NULL AND e.date IS NOT NULL
    ORDER BY e.date, e.Model
) TO 'src/data/eciScores.json' (FORMAT json, ARRAY true);

-- Consumer hardware (PC processors, games consoles, PC graphics cards) at
-- their peak speed, compiled by hand from the sources in
-- scripts/consumerHardware.csv
COPY (
    SELECT
        lower(regexp_replace(name, '[^A-Za-z0-9]+', '-', 'g')) AS id,
        name,
        kind,
        year,
        peak_flops_per_second::DOUBLE AS flopPerSecond,
        precision,
        source_url AS sourceUrl,
        notes
    FROM read_csv_auto('scripts/consumerHardware.csv')
    ORDER BY year, name
) TO 'src/data/consumerHardware.json' (FORMAT json, ARRAY true);
