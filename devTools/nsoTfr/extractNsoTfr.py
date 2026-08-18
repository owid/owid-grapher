#!/usr/bin/env python3
"""
One-off extraction of the TFR data embedded in Ed's "Total fertility rates:
national statistics vs. UN estimates" investigation HTML (prototype only).

The HTML contains, per country, an SVG chart whose series are encoded as pixel
coordinates. The axes are fully labeled (x tick labels = years, y tick labels =
TFR values at gridline positions), so the linear pixel->data mapping can be
recovered exactly with a least-squares fit per chart. The recovered latest NSO
values are validated against the exact values in the embedded ROWS array.

Usage: python3 devTools/nsoTfr/extractNsoTfr.py <tfr_charts.html> <out.json>
"""

import json
import re
import sys
from html import unescape


def strip_tags(html: str) -> str:
    text = re.sub(r"<[^>]+>", "", html)
    return unescape(text).strip()


def fit_linear(pairs):
    """Least-squares fit value -> pixel; returns (slope, intercept)."""
    n = len(pairs)
    sx = sum(p[0] for p in pairs)
    sy = sum(p[1] for p in pairs)
    sxx = sum(p[0] * p[0] for p in pairs)
    sxy = sum(p[0] * p[1] for p in pairs)
    denom = n * sxx - sx * sx
    slope = (n * sxy - sx * sy) / denom
    intercept = (sy - slope * sx) / n
    return slope, intercept


def invert(slope, intercept, pixel):
    return (pixel - intercept) / slope


def parse_path_points(d: str):
    return [
        (float(m.group(1)), float(m.group(2)))
        for m in re.finditer(r"[ML]\s*([\d.+-]+)\s*,\s*([\d.+-]+)", d)
    ]


def parse_abbrev_number(s: str) -> float:
    s = s.strip().replace(",", "")
    mult = 1.0
    if s.endswith("k"):
        mult, s = 1e3, s[:-1]
    elif s.endswith("m") or s.endswith("M"):
        mult, s = 1e6, s[:-1]
    return float(s) * mult


def snap(x: float, decimals: int = 3):
    """Round, and snap near-integers to ints for compact JSON."""
    r = round(x, decimals)
    return int(r) if abs(r - round(r)) < 10 ** -(decimals + 1) else r


def extract_tfr_svg(svg: str):
    """Invert the main fertility-rate SVG of one country section."""
    # x scale: year -> px, from the x tick labels
    x_pairs = [
        (float(m.group(2)), float(m.group(1)))
        for m in re.finditer(
            r'<text class="xlab" x="([\d.]+)" y="330">(\d+)</text>', svg
        )
    ]
    # y scale: value -> px. Tick label y sits 3.5px below its gridline.
    y_pairs = [
        (float(m.group(2)), float(m.group(1)) - 3.5)
        for m in re.finditer(
            r'<text class="ylab" x="36" y="([\d.]+)">([\d.]+)</text>', svg
        )
    ]
    if len(x_pairs) < 2 or len(y_pairs) < 2:
        return None
    xs, xi = fit_linear(x_pairs)
    ys, yi = fit_linear(y_pairs)

    def pt(px, py):
        return [snap(invert(xs, xi, px), 2), snap(invert(ys, yi, py), 4)]

    # WPP historical estimates: solid blue line
    wpp = []
    # WPP projection variants: dashed blue lines (class "ln proj"), in document
    # order high / medium / low (all start from the same last-estimate point)
    proj_variants = []
    for m in re.finditer(r'<path class="ln( proj)?" style="([^"]*)" d="([^"]*)"', svg):
        is_proj, style, d = m.group(1), m.group(2), m.group(3)
        points = [pt(px, py) for px, py in parse_path_points(d)]
        if "#3b82c4" in style:
            if is_proj:
                proj_variants.append(points)
            else:
                wpp = points
        elif "--nso" in style and not is_proj:
            pass  # NSO line: same vertices as the dots; dots are authoritative

    # NSO data points: the dots
    nso = [
        pt(float(m.group(1)), float(m.group(2)))
        for m in re.finditer(
            r'<circle class="dot" style="fill:var\(--nso\)" cx="([\d.]+)" cy="([\d.]+)"',
            svg,
        )
    ]

    result = {"nso": nso, "wpp": wpp}
    if len(proj_variants) == 3:
        # Identify variants by their endpoint value
        variants = sorted(proj_variants, key=lambda v: v[-1][1], reverse=True)
        result["wppProjection"] = {
            "high": variants[0],
            "medium": variants[1],
            "low": variants[2],
        }
    elif proj_variants:
        result["wppProjection"] = {"medium": proj_variants[0]}
    return result


def extract_births_svg(svg: str):
    """Invert the births-by-age dumbbell SVG (NSO vs WPP births per age group)."""
    x_pairs = []
    for m in re.finditer(
        r'<line class="grid" x1="([\d.]+)" y1="12"[^/]*/><text class="xlab" x="[\d.]+" y="\d+">([\dkmM.,]+)</text>',
        svg,
    ):
        x_pairs.append((parse_abbrev_number(m.group(2)), float(m.group(1))))
    if len(x_pairs) < 2:
        return None
    xs, xi = fit_linear(x_pairs)

    labels = [
        (strip_tags(m.group(2)), float(m.group(1)))
        for m in re.finditer(r'<text class="blab" x="74" y="([\d.]+)">([^<]+)</text>', svg)
    ]
    nso_pts = {
        float(m.group(2)): float(m.group(1))
        for m in re.finditer(r'<circle class="pn" cx="([\d.]+)" cy="([\d.]+)"', svg)
    }
    wpp_pts = {
        float(m.group(2)): float(m.group(1))
        for m in re.finditer(r'<circle class="pw" cx="([\d.]+)" cy="([\d.]+)"', svg)
    }
    groups = []
    for label, label_y in labels:
        cy = label_y - 4.0  # label sits 4px below the dumbbell centerline
        row = {"age": label}
        for key, pts in (("nso", nso_pts), ("wpp", wpp_pts)):
            match = next((y for y in pts if abs(y - cy) < 2.5), None)
            if match is not None:
                row[key] = snap(invert(xs, xi, pts[match]), 0)
        groups.append(row)
    return groups


def main(html_path: str, out_path: str) -> None:
    html = open(html_path, encoding="utf-8").read()

    rows = json.loads(re.search(r"const ROWS = (\[.*?\]);\n", html, re.S).group(1))
    tiers = json.loads(re.search(r"const TIERS = (\{.*?\});\n", html, re.S).group(1))
    unplotted = json.loads(
        re.search(r"const UNPLOTTED = (\[.*?\]);\n", html, re.S).group(1)
    )
    rows_by_country = {r["country"]: r for r in rows}

    countries = {}
    warnings = []
    for m in re.finditer(
        r'<section data-country="([^"]+)">(.*?)</section>', html, re.S
    ):
        name, body = unescape(m.group(1)), m.group(2)
        row = rows_by_country.get(name)

        source_m = re.search(r'<p class="src">(.*?)</p>', body, re.S)
        entry = {
            "country": name,
            "source": strip_tags(source_m.group(1)) if source_m else None,
        }
        if row:
            entry.update(
                iso=row.get("iso"),
                short=row.get("short"),
                tier=row.get("tier"),
                tierLabel=tiers.get(row.get("tier"), [None])[0],
                recalculated=row.get("recalc"),
                latest={
                    "year": row.get("year"),
                    "nso": row.get("nso"),
                    "wpp": row.get("wpp"),
                },
            )

        tfr_svg_m = re.search(
            r'<svg viewBox="0 0 940 340"[^>]*aria-label="[^"]*fertility rate">(.*?)</svg>',
            body,
            re.S,
        )
        if tfr_svg_m:
            series = extract_tfr_svg(tfr_svg_m.group(1))
            if series:
                entry.update(series)
                # Validate the inversion against the exact latest value in ROWS
                if row and series["nso"]:
                    latest = max(series["nso"], key=lambda p: p[0])
                    if abs(latest[1] - row["nso"]) > 0.02:
                        warnings.append(
                            f"{name}: decoded latest NSO {latest[1]} vs ROWS {row['nso']}"
                        )

        # Prose: the <dl class="docs"> dt/dd pairs
        docs_m = re.search(r'<dl class="docs">(.*?)</dl>', body, re.S)
        if docs_m:
            pairs = re.findall(r"<dt>(.*?)</dt><dd>(.*?)</dd>", docs_m.group(1), re.S)
            entry["docs"] = {strip_tags(k): strip_tags(v) for k, v in pairs}

        births_m = re.search(
            r'<div class="detail">.*?<h3>([^<]*)</h3><svg viewBox="0 0 940 \d+"[^>]*aria-label="births">(.*?)</svg>',
            body,
            re.S,
        )
        if births_m:
            groups = extract_births_svg(births_m.group(2))
            if groups:
                entry["birthsByAge"] = {
                    "title": strip_tags(births_m.group(1)),
                    "groups": groups,
                }
        na_m = re.search(r'<p class="na">(.*?)</p>', body, re.S)
        if na_m:
            entry["note"] = strip_tags(na_m.group(1))

        countries[name] = entry

    out = {
        "description": (
            "Total fertility rates from national statistics offices (NSO) vs UN WPP "
            "estimates, extracted from an internal OWID investigation of the 100 most "
            "populous countries. Prototype data — series values were recovered by "
            "inverting labeled SVG chart coordinates and are accurate to ~0.005. "
            "Each series is a list of [year, tfr] pairs."
        ),
        "tiers": tiers,
        "unplotted": unplotted,
        "countries": countries,
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

    n_nso = sum(1 for c in countries.values() if c.get("nso"))
    print(f"countries: {len(countries)}, with NSO series: {n_nso}")
    for w in warnings:
        print("WARN", w)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
