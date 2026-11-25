-- Regenerates the bundled data files from Epoch AI's published datasets.
-- Usage (from the project root):
--   curl -sL -o /tmp/notable_ai_models.csv https://epoch.ai/data/notable_ai_models.csv
--   curl -sL -o /tmp/frontier_ai_models.csv https://epoch.ai/data/frontier_ai_models.csv
--   curl -sL -o /tmp/all_ai_models.csv https://epoch.ai/data/all_ai_models.csv
--   curl -sL -o /tmp/benchmark_data.zip https://epoch.ai/data/benchmark_data.zip
--   unzip -o -d /tmp/benchmark_data /tmp/benchmark_data.zip
--   duckdb -c ".read scripts/buildData.sql"

-- The notable and frontier files each lack some columns (the estimation
-- method, the organization categorization), so the rows come from the
-- all-models file, which covers both sets
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
FROM read_csv_auto('/tmp/all_ai_models.csv');

CREATE TEMP TABLE notable AS
SELECT Model AS model FROM read_csv_auto('/tmp/notable_ai_models.csv');

-- Frontier: in the top 5 by training compute at the time of release
CREATE TEMP TABLE frontier AS
SELECT Model AS model FROM read_csv_auto('/tmp/frontier_ai_models.csv');

-- Models with a training compute estimate that are notable, frontier or
-- both: the scatter, which shows one set or the other
COPY (
    SELECT
        a.model,
        a.organization,
        a.organizationCategory,
        strftime(a.publicationDate, '%Y-%m-%d') AS date,
        a.trainingComputeFlop,
        a.computeEstimationMethod,
        -- Epoch's row for GPT-6 Astra has no link yet
        coalesce(a.link, CASE WHEN a.model = 'GPT-6 Astra'
            THEN 'https://openai.com/index/gpt-6-astra/' END) AS link,
        a.domain,
        a.confidence,
        a.model IN (SELECT model FROM notable) AS isNotable,
        a.model IN (SELECT model FROM frontier) AS isFrontier
    FROM all_models a
    WHERE (a.model IN (SELECT model FROM notable)
            OR a.model IN (SELECT model FROM frontier))
        AND a.trainingComputeFlop IS NOT NULL
        AND a.publicationDate IS NOT NULL
    ORDER BY a.publicationDate, a.model
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
