# /// script
# requires-python = ">=3.10"
# dependencies = ["pydantic-ai-slim[google]", "pydantic"]
# ///
"""
Your Life in Data — AI curation (offline, baked; runtime stays AI-free).

For each showcase country and each OWID subtopic, hand Gemini Flash Lite the full list of
that subtopic's Featured-Metrics indicators — with OWID description, unit, whether it's an
absolute total (not comparable to the World), and the country's long-run then→now numbers —
and let the AI decide which are interesting/relatable for a "what changed since you were born"
card. No mechanical filters: the AI is given the info (flat? absolute total? technical?) and
makes the call itself. Curating per subtopic guarantees every subtopic is represented.

Output: data/curated-ai.json (per-country picks, tagged by subtopic + pre-baked series).
The runtime ranks each subtopic's picks by the user's actual birth-year change.

Run:  uv run assets/ai_curate.py            # default countries
      uv run assets/ai_curate.py CZE ETH    # specific ISO3 codes
"""
import asyncio
import csv
import io
import json
import os
import sys
from pathlib import Path

from pydantic import BaseModel, Field
from pydantic_ai import Agent

HERE = Path(__file__).resolve().parent
APP = HERE.parent
CACHE = HERE / "cache"
# Build intermediates (catalog.json, the legacy curated-ai.json) live in data/, alongside this
# project. The three files the React app actually imports (countries/curated-global/refinements)
# live in src/data/ instead — writing directly there means one canonical copy, not a build output
# that has to be manually re-copied into the app (which is how USA's refinements went missing).
SRC_DATA = APP / "src" / "data"
CATALOG = json.loads((APP / "data" / "catalog.json").read_text())["areas"]

WORLD = "OWID_WRL"
DEFAULT_COUNTRIES = ["CZE", "ESP", "USA", "ETH"]  # +World always; ETH = developing-country contrast
MODEL_NAME = os.environ.get("YLID_MODEL", "google:gemini-flash-latest")  # Flash: best direction discipline for ~3x Lite's cost; YLID_MODEL to override; "google" not "google-gla" — pydantic-ai renamed the provider
MAX_CONCURRENT = 6
# Gemini Flash Lite pricing ($ per 1M tokens), approximate — adjust when pinning a version.
PRICE_IN, PRICE_OUT = 0.10, 0.40
USAGE = {"in": 0, "out": 0}  # accumulated across all calls

if not os.environ.get("GEMINI_API_KEY") and os.environ.get("GOOGLE_API_KEY"):
    os.environ["GEMINI_API_KEY"] = os.environ["GOOGLE_API_KEY"]


def record_usage(result):
    try:
        u = result.usage
        USAGE["in"] += getattr(u, "input_tokens", 0) or 0
        USAGE["out"] += getattr(u, "output_tokens", 0) or 0
    except (AttributeError, TypeError):
        pass


SUBTOPICS = list(CATALOG.keys())


class Pick(BaseModel):
    slug: str
    label: str = Field(description="Short, friendly card label, e.g. 'Life expectancy'")
    good_direction: str = Field(description=(
        "'up' if rising is clearly good, 'down' if falling is clearly good, else 'none'. "
        "Reserve up/down for broad consensus (health, mortality, income, literacy, rights, "
        "pollution, safety). Use 'none' when 'better' is genuinely subjective — e.g. fertility "
        "rate, household size, marriage age/rates, religiosity, urbanization, migration. "
        "House view on a few otherwise-debated ones (use these): nuclear power & clean energy = "
        "'up'; FALLING working hours = good, so 'down'; rising median age = 'up' (longevity); "
        "FALLING armed-forces personnel is a bad sign, so 'up'."))
    subtopic: str = Field(default="", description=(
        "If this indicator clearly belongs to a DIFFERENT subtopic than the one being curated "
        f"(e.g. obesity belongs to Health, not Food), name the best fit from: {SUBTOPICS}. "
        "Otherwise leave blank."))
    framing: str = Field(default="relative", description=(
        "How to phrase the change on the card. 'relative' when the multiple is the story "
        "(GDP ≈ doubled, child mortality cut by ¾, deaths halved). 'absolute' when the size of the "
        "change in the metric's OWN units is the story — use this for SHARES/percentages (internet "
        "'+87 percentage points', not '% of a %'), for years (life expectancy '+7 years'), and for "
        "indices ('+0.3'). Rule of thumb: a percentage/share metric → 'absolute', UNLESS its relative "
        "change is what matters (a rate like mortality) → 'relative'."))


class Curation(BaseModel):
    picks: list[Pick] = Field(description="The interesting indicators for this subtopic, best first; empty if none")


class Exclusion(BaseModel):
    slug: str
    reason: str = Field(description="One short phrase: why this metric is uninformative for THIS country")


class Promotion(BaseModel):
    slug: str = Field(description="Slug of a featured metric to bring onto this country's card")
    label: str = Field(default="", description="Short, friendly card label, e.g. 'Deaths from diarrheal disease'")
    good_direction: str = Field(default="none", description=Pick.model_fields["good_direction"].description)
    framing: str = Field(default="relative", description=Pick.model_fields["framing"].description)
    reason: str = Field(description="One short phrase: why this metric is especially central for THIS country")


class Refinement(BaseModel):
    exclude: list[Exclusion] = Field(
        default_factory=list,
        description="Spine metrics to HIDE for this country+topic; empty if all are informative")
    promote: list[Promotion] = Field(
        default_factory=list,
        description="Featured metrics to ADD/lift onto this country's card; empty if the spine already fits")


agent = Agent(
    MODEL_NAME,
    output_type=Curation,
    system_prompt=(
        "You curate one subtopic of a shareable 'What changed in {country} since you were born' "
        "data card, for a general (non-expert) audience. You are given that subtopic's candidate "
        "indicators with the country's long-run change. Pick the ones that are genuinely "
        "INTERESTING and RELATABLE — things a normal person feels in their own life and would "
        "share. Use the data you're given to decide:\n"
        "- DROP indicators that barely changed, or that are ~zero / negligible for THIS country "
        "(e.g. polio cases or informal employment in a rich country): boring.\n"
        "- Judge how big a change really is from the before/after numbers yourself — a large % swing "
        "off a tiny base (1% → 0.3%) is a small real change; weigh the absolute movement, not just the ratio.\n"
        "- DROP technical / wonky / niche indicators a normal person wouldn't recognise "
        "(e.g. 'cereals used for industry', 'state capacity index', 'laying hens in cages').\n"
        "- A raw absolute total tells a normal person nothing ('solar generation: 0 → 196'?!). "
        "When a per-capita / share / rate version of the same thing exists, ALWAYS take it and "
        "REJECT the total: pick 'share of electricity from solar' or 'solar per person', NEVER "
        "'solar generation (TWh)'; 'meat per person', never 'total meat (tonnes)'. An absolute "
        "total is allowed ONLY when there is genuinely no normalized version AND it's striking on "
        "its own (e.g. space launches, clinical trials); we won't draw a world comparison for those.\n"
        "- PREFER big, surprising, human, or plain COOL changes.\n"
        "- INCLUDE at least one metric that got WORSE over this period, if the country has one — an "
        "honest card shows the bad alongside the good, it shouldn't read like a brochure.\n"
        "- Pick only the SINGLE best version of a concept — never two near-duplicates "
        "(e.g. don't pick both 'employment in agriculture' and 'share of employment in agriculture', "
        "or two internet measures).\n"
        "Pick AT LEAST 3 indicators (whenever at least 3 have data), up to ~8. Lead with the "
        "genuinely interesting ones; if there aren't enough striking ones, it's fine to include "
        "flatter / less-dramatic ones to reach 3 — a subtopic should never show just 1-2. Best "
        "first. Give each a clean label, the good-direction, and (only if it clearly belongs "
        "elsewhere) a better subtopic."
    ),
)


overall_agent = Agent(
    MODEL_NAME,
    output_type=Curation,
    system_prompt=(
        "You assemble the headline 'most interesting' set for a shareable "
        "'What changed in {country} since you were born' card, for a general audience. "
        "You're given already-curated indicators from across all topics, with the country's "
        "long-run change. Pick the ~10 MOST striking and relatable, and make them DIVERSE: "
        "spread across different topics, and never include two near-duplicates of the same thing "
        "(e.g. two internet measures). Best first. Keep each indicator's slug; give a clean label "
        "and good-direction."
    ),
)


_GLOBAL_RULES = (
    "Rank by importance + relatability + recognizability to a general audience, and broad "
    "country coverage. DROP any candidate that a general reader wouldn't consider part of THIS "
    "topic, even though it's tagged here — OWID's topic tags bleed (e.g. tax revenue, quality of "
    "public administration, or a 'state capacity' index are governance/economy, NOT 'Violence & "
    "War'); leave it out so a genuinely on-topic indicator takes its place. PREFER per-capita / "
    "share / rate over absolute totals (never 'total meat (tonnes)' when 'meat per person' "
    "exists). DROP technical/wonky indicators a normal person wouldn't recognise. Never include "
    "two near-duplicates of the same concept. Best/most-essential first. Give each a clean label, "
    "the good-direction, and framing. " + Pick.model_fields["good_direction"].description
)

# Country-AGNOSTIC: rank one topic's indicators into a single global "key indicators" list,
# reused for every country (the runtime then drops ones a country lacks data for, in order).
global_agent = Agent(
    MODEL_NAME,
    output_type=Curation,
    system_prompt=(
        "You build OWID's canonical ranked list of the most important indicators for ONE topic "
        "of a 'What changed since you were born' card — the same list will be used for every "
        "country, so judge importance in general, not for any single country. Return ~10 indicators. "
        "The candidates already carry OWID's own editorial importance (`owid_rank`, 1 = most "
        "important) and are pre-sorted by it — treat that as a STRONG PRIOR for your ranking, "
        "and only depart from it for relatability, coverage, or de-duplication reasons. "
        + _GLOBAL_RULES
    ),
)


# Per COUNTRY+TOPIC refinement of the global list. The agent sees the topic's default card (the
# global spine) AND the rest of the topic's featured metrics with this country's numbers, and edits
# the card: EXCLUDE spine metrics that are non-stories here, PROMOTE featured metrics that are
# especially central here. Judgment lives in the prompt; baked + auditable, not per-visitor.
refine_agent = Agent(
    MODEL_NAME,
    output_type=Refinement,
    system_prompt=(
        "You tailor OWID's global key-indicator list for ONE country and ONE topic. You're given "
        "two things, each with THIS country's own long-run numbers (then → now):\n"
        "(A) the SPINE — the importance-ranked default card the same for every country; and\n"
        "(B) OTHER featured metrics in this topic (also OWID-curated) that are NOT on the default "
        "card.\n"
        "We show about SIX indicators per topic. You may make two kinds of edit:\n"
        "• EXCLUDE — hide a SPINE metric that is genuinely uninformative for THIS country:\n"
        "   - a disease/phenomenon at a NICHE LEVEL here, small in absolute terms across the whole "
        "period (HIV well under ~1% of the population, malaria, child marriage, open defecation in "
        "a rich country) EVEN IF it drifted — too low to be part of life here;\n"
        "   - a metric pinned at a floor/ceiling all period (already ~100% or ~0%), so nothing "
        "changed;\n"
        "   - something that simply doesn't apply here.\n"
        "• PROMOTE — bring a metric from (B) onto the card (or lift one already on it) when it is "
        "ESPECIALLY CENTRAL to this country's situation and the spine misses it — e.g. for a "
        "low-income country whose health story is infectious disease, child/maternal mortality and "
        "health systems rather than the spine's lifestyle/NCD metrics, you might promote deaths "
        "from diarrheal disease, polio eradication, or vaccination coverage. Promoted metrics lead "
        "the card and push the spine's secondary tail below the six-metric cut, so you usually "
        "needn't also exclude those. Give each promotion a clean label, good-direction and framing.\n"
        "NEVER promote a metric that's a near-duplicate of one already on the spine (e.g. don't "
        "promote 'share of adults who are obese' alongside the spine's 'share of adults who are "
        "overweight or obese' — same underlying story, told twice). If a metric from (B) covers "
        "essentially the same concept as a spine metric, either skip the promotion or EXCLUDE the "
        "spine one first and promote the better-fitting version in its place — never show both.\n"
        "BE CONSERVATIVE. The spine is already good: for MOST countries you should change little or "
        "nothing. Edit substantially ONLY when the country genuinely diverges from the global "
        "default (a special case like a developing country). Don't promote a metric just because "
        "it's interesting, and don't exclude one merely for being less dramatic or lower-ranked. "
        "Changing NOTHING is a perfectly good answer. Aim for at most ~3 of each, usually fewer. "
        "Ground every reason in this country's numbers."
    ),
)


def country_series(slug, value_col, code):
    p = CACHE / f"{slug}.csv"
    if not p.exists() or not p.stat().st_size:
        return []
    reader = csv.reader(io.StringIO(p.read_text()))
    header = next(reader, None)
    if not header:
        return []
    low = [h.strip().lower() for h in header]
    if "code" not in low or "year" not in low:
        return []
    ci, yi = low.index("code"), low.index("year")
    vi = low.index(value_col.lower()) if value_col.lower() in low else next(
        (i for i in range(len(low)) if low[i] not in ("entity", "code", "year")), -1)
    if vi < 0:
        return []
    out = []
    for row in reader:
        if len(row) <= max(ci, yi, vi) or row[ci] != code:
            continue
        try:
            out.append([int(row[yi]), float(row[vi])])
        except ValueError:
            pass
    out.sort()
    return [p for p in out if p[0] >= 1900]


def candidates(code, items):
    rows = []
    for e in items:
        s = country_series(e["slug"], e["valueColumn"], code)
        if len(s) < 2:
            continue
        then, now = s[0], s[-1]
        # give the model the raw before/after, NOT a computed ratio — a % ratio is
        # unreliable on low baselines (a "75% drop" from 1% is tiny in absolute terms)
        rows.append({
            "slug": e["slug"], "label": e["label"], "desc": (e.get("desc") or "")[:140],
            "unit": e.get("unit", ""), "absolute_total": not e.get("comparable", True),
            "then_year": then[0], "then": round(then[1], 3),
            "now_year": now[0], "now": round(now[1], 3),
        })
    return rows


async def curate(code, area, items, sem):
    cands = candidates(code, items)
    if not cands:
        return code, area, [], []
    prompt = (f"Country: {code}. Subtopic: {area}. Candidate indicators with this country's "
              f"long-run change:\n{json.dumps(cands, ensure_ascii=False)}")
    async with sem:
        result = await agent.run(prompt)
    record_usage(result)
    valid = {c["slug"] for c in cands}
    picks = [p for p in result.output.picks if p.slug in valid]
    return code, area, picks, cands


async def topup(code, area, have_labels, used, cands, sem):
    """Re-ask the AI for enough MORE picks to reach 3 in a subtopic (post-rehoming check)."""
    remaining = [c for c in cands if c["slug"] not in used]
    n = 3 - len(have_labels)
    if n <= 0 or len(remaining) < n:
        return code, area, []
    prompt = (f"The '{area}' subtopic for {code} only has {len(have_labels)} indicators "
              f"({have_labels}), but every subtopic must show AT LEAST 3. Pick {n} MORE that "
              f"belong in {area} — flatter / less-dramatic is fine — best first, from:\n"
              f"{json.dumps(remaining, ensure_ascii=False)}")
    async with sem:
        r = await agent.run(prompt)
    record_usage(r)
    valid = {c["slug"] for c in remaining}
    return code, area, [p for p in r.output.picks if p.slug in valid][:n]


def to_metric(by_slug, slug, p, area):
    """Build a full runtime metric dict from a catalog entry + an AI pick (Pick/Promotion:
    carries .label/.good_direction/.framing). Shared by the global build and the refine build."""
    e = by_slug[slug]
    return {
        "slug": slug, "valueColumn": e["valueColumn"], "label": p.label or e["label"],
        "subtopic": area, "format": e["format"], "comparable": e.get("comparable", True),
        "goodDirection": p.good_direction if p.good_direction in ("up", "down", "none") else "none",
        "framing": p.framing if p.framing in ("relative", "absolute") else "relative",
        "unit": e.get("unit", ""), "desc": e.get("desc", ""), "source": e.get("source", ""),
    }


async def build_global():
    """Country-agnostic: one ranked 'key indicators' list per topic + a deterministic
    Highlights set (the top metric of each topic). Written to src/data/curated-global.json,
    which is hand-editable (the auditable editorial spine). Runtime walks each list and
    drops metrics a given country lacks data/coverage for."""
    by_slug = {e["slug"]: dict(e, subtopic=area) for area, items in CATALOG.items() for e in items}
    sem = asyncio.Semaphore(MAX_CONCURRENT)
    print(f"Building global key-indicator lists via {MODEL_NAME}…", file=sys.stderr)

    async def rank_topic(area, items):
        # `owid_rank` = OWID's own editorial importance for this metric (1 = most important);
        # the candidate list is already pre-sorted by it. Given to the model as a strong prior.
        cands = [{"slug": e["slug"], "label": e["label"], "desc": (e.get("desc") or "")[:140],
                  "unit": e.get("unit", ""), "absolute_total": not e.get("comparable", True),
                  "owid_rank": e.get("fmRank"), "n_countries": e.get("nCountries"),
                  "year_start": e.get("yearStart"), "year_end": e.get("yearEnd")} for e in items]
        if not cands:
            return area, []
        async with sem:
            r = await global_agent.run(f"Topic: {area}. Candidate indicators (judge for ALL "
                                       f"countries, no single-country numbers):\n{json.dumps(cands, ensure_ascii=False)}")
        record_usage(r)
        valid, seen, out = {c["slug"] for c in cands}, set(), []
        for p in r.output.picks:
            if p.slug in valid and p.slug not in seen:
                seen.add(p.slug)
                out.append(to_metric(by_slug, p.slug, p, area))
        return area, out

    topics = dict(await asyncio.gather(*[rank_topic(a, items) for a, items in CATALOG.items()]))
    # Highlights = the top metric of every topic (deterministic, diverse by construction)
    highlights = [topics[a][0] for a in CATALOG if topics.get(a)]

    out_path = SRC_DATA / "curated-global.json"
    out_path.write_text(json.dumps({"model": MODEL_NAME, "topics": topics, "highlights": highlights}, indent=0))
    cost = (USAGE["in"] * PRICE_IN + USAGE["out"] * PRICE_OUT) / 1e6
    for a in CATALOG:
        print(f"    {a:24} {len(topics.get(a, []))}", file=sys.stderr)
    print(f"  highlights: {len(highlights)} (top of each topic)", file=sys.stderr)
    print(f"✓ wrote curated-global.json  ~${cost:.4f}", file=sys.stderr)


def country_change(slug, value_col, code):
    """This country's first/last data point for a metric, or None if <2 points cached."""
    s = country_series(slug, value_col, code)
    if len(s) < 2:
        return None
    return {"then_year": s[0][0], "then": round(s[0][1], 3),
            "now_year": s[-1][0], "now": round(s[-1][1], 3)}


def _cand(e, ch):
    """A candidate row for the refine prompt: identity + this country's then→now numbers."""
    return {"slug": e["slug"], "label": e["label"], "desc": (e.get("desc") or "")[:140],
            "unit": e.get("unit", ""), "absolute_total": not e.get("comparable", True), **ch}


async def build_refinements(codes):
    """Per country+topic, the AI edits the global spine for that country: EXCLUDE spine metrics
    that are non-stories here, PROMOTE other featured metrics that are especially central here.
    Written to src/data/curated-refinements.json (country → topic → {exclude:[{slug,reason}],
    promote:[<full metric dict>+reason]}), hand-editable. Merges into any existing file so a
    per-country rerun doesn't wipe the others. Conservative by design — most topics change
    little or nothing; promotions draw from the same featured-metrics pool as the spine."""
    by_slug = {e["slug"]: dict(e, subtopic=area) for area, items in CATALOG.items() for e in items}
    spine = json.loads((SRC_DATA / "curated-global.json").read_text())["topics"]
    sem = asyncio.Semaphore(MAX_CONCURRENT)
    print(f"AI refinements for {codes} via {MODEL_NAME}…", file=sys.stderr)

    async def refine_topic(code, area, spine_metrics):
        spine_slugs = {m["slug"] for m in spine_metrics}
        # spine metrics (the default card) and the other featured metrics in this area, each with
        # this country's numbers; skip metrics with no country data (the runtime drops those anyway)
        spine_cands, other_cands = [], []
        for m in spine_metrics:
            ch = country_change(m["slug"], m["valueColumn"], code)
            if ch:
                spine_cands.append(_cand(m, ch))
        for e in CATALOG[area]:
            if e["slug"] in spine_slugs:
                continue
            ch = country_change(e["slug"], e["valueColumn"], code)
            if ch:
                other_cands.append(_cand(e, ch))
        if not spine_cands:
            return code, area, {}
        async with sem:
            r = await refine_agent.run(
                f"Country: {code}. Topic: {area}.\n"
                f"(A) SPINE — the default card, importance-ranked:\n{json.dumps(spine_cands, ensure_ascii=False)}\n"
                f"(B) OTHER featured metrics in this topic (not on the card):\n{json.dumps(other_cands, ensure_ascii=False)}")
        record_usage(r)
        excl = [{"slug": e.slug, "reason": e.reason}
                for e in r.output.exclude if e.slug in spine_slugs]
        area_slugs = {e["slug"] for e in CATALOG[area]}
        promo = [dict(to_metric(by_slug, p.slug, p, area), reason=p.reason)
                 for p in r.output.promote if p.slug in area_slugs]
        out = {}
        if excl:
            out["exclude"] = excl
        if promo:
            out["promote"] = promo
        return code, area, out

    jobs = [refine_topic(code, area, metrics) for code in codes for area, metrics in spine.items()]
    results = await asyncio.gather(*jobs)

    out_path = SRC_DATA / "curated-refinements.json"
    data = json.loads(out_path.read_text()) if out_path.exists() else {}
    data.setdefault("model", MODEL_NAME)
    by_country = data.setdefault("countries", {})
    for code in codes:
        by_country[code] = {}
    for code, area, ref in results:
        if ref:
            by_country[code][area] = ref
    out_path.write_text(json.dumps(data, indent=0))
    cost = (USAGE["in"] * PRICE_IN + USAGE["out"] * PRICE_OUT) / 1e6
    for code in codes:
        nx = sum(len(v.get("exclude", [])) for v in by_country[code].values())
        npr = sum(len(v.get("promote", [])) for v in by_country[code].values())
        print(f"    {code}: {nx} excluded, {npr} promoted across {len(by_country[code])} topics", file=sys.stderr)
    print(f"✓ wrote curated-refinements.json  ~${cost:.4f}", file=sys.stderr)


async def main():
    codes = [a.upper() for a in sys.argv[1:]] or DEFAULT_COUNTRIES
    by_slug = {e["slug"]: dict(e, subtopic=area) for area, items in CATALOG.items() for e in items}
    sem = asyncio.Semaphore(MAX_CONCURRENT)
    print(f"AI-curating {codes} per subtopic via {MODEL_NAME}…", file=sys.stderr)

    jobs = [curate(code, area, items, sem) for code in codes for area, items in CATALOG.items()]
    results = await asyncio.gather(*jobs)

    area_set = set(SUBTOPICS)
    metrics_by_country, need = {c: [] for c in codes}, set()
    seen_by_country = {c: set() for c in codes}
    cands_by = {}  # (code, area) -> candidate list, for the >=3 top-up re-ask

    def add_pick(code, p, area, rehome=True):
        e = by_slug.get(p.slug)
        if not e or p.slug in seen_by_country[code]:  # dedupe: a slug appears under one subtopic
            return
        seen_by_country[code].add(p.slug)
        assigned = p.subtopic if (rehome and p.subtopic in area_set) else area  # AI may re-home
        metrics_by_country[code].append({
            "slug": p.slug, "valueColumn": e["valueColumn"], "label": p.label or e["label"],
            "subtopic": assigned, "format": e["format"], "comparable": e.get("comparable", True),
            "goodDirection": p.good_direction if p.good_direction in ("up", "down", "none") else "none",
            "framing": p.framing if p.framing in ("relative", "absolute") else "relative",
            "unit": e.get("unit", ""), "desc": e.get("desc", ""), "source": e.get("source", ""),
        })
        need.add(p.slug)

    for code, area, picks, cands in results:
        cands_by[(code, area)] = cands
        for p in picks:
            add_pick(code, p, area, rehome=True)

    # enforce >=3 per subtopic AFTER re-homing: re-ask the AI for top-ups where a subtopic is short
    def short_subtopics():
        out = []
        for code in codes:
            for area in SUBTOPICS:
                have = [m["label"] for m in metrics_by_country[code] if m["subtopic"] == area]
                if len(have) < 3 and len(cands_by.get((code, area), [])) >= 3:
                    out.append((code, area, have))
        return out
    short = short_subtopics()
    if short:
        print(f"  topping up {len(short)} short subtopic(s) to >=3…", file=sys.stderr)
        tjobs = [topup(code, area, have, seen_by_country[code], cands_by[(code, area)], sem)
                 for code, area, have in short]
        for code, area, more in await asyncio.gather(*tjobs):
            for p in more:
                add_pick(code, p, area, rehome=False)

    # dedicated "most interesting" selection: one call per country over all its picks,
    # so the headline set is diverse and free of cross-subtopic near-duplicates
    async def pick_overall(code):
        uniq = {}
        for m in metrics_by_country[code]:
            uniq.setdefault(m["slug"], m)
        cands = []
        for slug, m in uniq.items():
            s = country_series(slug, m["valueColumn"], code)
            if len(s) < 2:
                continue
            then, now = s[0], s[-1]
            cands.append({"slug": slug, "label": m["label"], "subtopic": m["subtopic"],
                          "then": round(then[1], 3), "now": round(now[1], 3)})
        if not cands:
            return code, []
        async with sem:
            res = await overall_agent.run(f"Country: {code}. Curated indicators:\n{json.dumps(cands, ensure_ascii=False)}")
        record_usage(res)
        chosen = [p for p in res.output.picks if p.slug in uniq]
        out = []
        for p in chosen:
            base = uniq[p.slug]
            out.append({**base, "label": p.label or base["label"],
                        "goodDirection": p.good_direction if p.good_direction in ("up", "down", "none") else base["goodDirection"]})
        return code, out

    overall_by_country = dict(await asyncio.gather(*[pick_overall(c) for c in codes]))

    # bake the chosen countries + the comparison aggregates (World, continents, income groups)
    # straight from the cached full CSVs — reliable and complete, where the aggregate exists.
    AGG = ["OWID_AFR", "OWID_ASI", "OWID_EUR", "OWID_NAM", "OWID_SAM", "OWID_OCE",
           "OWID_HIC", "OWID_UMC", "OWID_LMC", "OWID_LIC"]
    data = {}
    for code in codes + [WORLD] + AGG:
        for slug in need:
            s = country_series(slug, by_slug[slug]["valueColumn"], code)
            if s:
                data.setdefault(code, {})[slug] = s

    # merge into any existing file so re-running for one country doesn't drop the others
    out_path = Path(os.environ["YLID_OUT"]) if os.environ.get("YLID_OUT") else APP / "data" / "curated-ai.json"
    merged = {"model": MODEL_NAME, "countries": [], "world": WORLD,
              "metricsByCountry": {}, "overallByCountry": {}, "data": {}}
    if out_path.exists():
        try:
            merged.update(json.loads(out_path.read_text()))
        except json.JSONDecodeError:
            pass
    merged["metricsByCountry"].update(metrics_by_country)
    merged["overallByCountry"].update(overall_by_country)
    merged["data"].update(data)
    merged["countries"] = sorted(set(merged.get("countries", [])) | set(codes))
    merged["model"] = MODEL_NAME
    out_path.write_text(json.dumps(merged, indent=0))

    cost = (USAGE["in"] * PRICE_IN + USAGE["out"] * PRICE_OUT) / 1e6
    for c in codes:
        print(f"  {c}: {len(metrics_by_country[c])} subtopic picks, {len(overall_by_country[c])} overall", file=sys.stderr)
    print(f"✓ wrote {out_path.name} (now has: {', '.join(merged['countries'])})", file=sys.stderr)
    print(f"  tokens: {USAGE['in']:,} in + {USAGE['out']:,} out  →  ~${cost:.4f} for {len(codes)} country(ies)", file=sys.stderr)


if __name__ == "__main__":
    if "--global" in sys.argv:
        asyncio.run(build_global())
    elif "--refine" in sys.argv:
        rest = [a for a in sys.argv[1:] if a != "--refine"]
        codes = [a.upper() for a in rest] or DEFAULT_COUNTRIES
        asyncio.run(build_refinements(codes))
    else:
        asyncio.run(main())
