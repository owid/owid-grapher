/**
 * DARK MODE PROTOTYPE
 *
 * Inline, render-blocking script that sets the theme attributes on <html>
 * before first paint (no flash of the light theme on a statically baked page),
 * plus a small floating switcher to compare the proposals.
 *
 * Modes:
 *   light   – today's site
 *   dark-a  – proposal A: dark site, charts stay light "islands"
 *   system  – follows prefers-color-scheme (dark → dark-a)
 *
 * Dark palettes (only shown while the page is dark):
 *   current, midnight, slate, ink – see $dark-palette-variants in
 *   components/src/styles/colors.scss
 *
 * Proposal C (dark charts with adapted data colors) has been removed from the
 * options; "dark-c" is mapped to "dark-a". Its chart code is still in place.
 *
 * Override per page with `?theme=dark-a` and `?palette=midnight`. The choices
 * are kept in localStorage under "owid-theme" and "owid-dark-palette".
 */

const themeScript = `(function () {
    var KEY = "owid-theme";
    var PALETTE_KEY = "owid-dark-palette";
    var MODES = ["light", "dark-a", "system"];
    var PALETTES = ["current", "midnight", "slate", "ink"];
    // Dark C was removed from the options; anyone who had it picked (or a
    // shared ?theme=dark-c link) lands on Dark A instead of falling back to
    // light. The dark-chart code is still in place if it's needed again.
    var RETIRED = { "dark-c": "dark-a" };
    var mql = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

    function normalize(v) {
        if (v && RETIRED[v]) return RETIRED[v];
        return MODES.indexOf(v) !== -1 ? v : null;
    }

    function readChoice(param, key, isValid, fallback) {
        try {
            var fromUrl = new URLSearchParams(location.search).get(param);
            fromUrl = isValid(fromUrl);
            if (fromUrl) {
                localStorage.setItem(key, fromUrl);
                return fromUrl;
            }
            var v = isValid(localStorage.getItem(key));
            if (v) localStorage.setItem(key, v);
            return v || fallback;
        } catch (e) {
            return fallback;
        }
    }

    function validPalette(v) {
        return PALETTES.indexOf(v) !== -1 ? v : null;
    }

    function resolve(mode) {
        if (mode === "system") return mql && mql.matches ? "dark-a" : "light";
        return mode;
    }

    var mode = readChoice("theme", KEY, normalize, "light");
    var palette = readChoice("palette", PALETTE_KEY, validPalette, "current");

    function isDark() {
        return resolve(mode) !== "light";
    }

    function apply() {
        var r = resolve(mode);
        var root = document.documentElement;
        root.setAttribute("data-theme-mode", mode);
        root.setAttribute("data-theme", r === "light" ? "light" : "dark");
        root.setAttribute("data-chart-theme", r === "dark-c" ? "dark" : "light");
        root.setAttribute("data-dark-palette", palette);
    }

    apply();
    if (mql && mql.addEventListener) {
        mql.addEventListener("change", function () { apply(); render(); });
    }

    window.__owidSetTheme = function (m) {
        mode = m;
        try { localStorage.setItem(KEY, m); } catch (e) {}
        apply();
        render();
    };

    window.__owidSetDarkPalette = function (p) {
        palette = p;
        try { localStorage.setItem(PALETTE_KEY, p); } catch (e) {}
        apply();
        render();
    };

    var LABELS = { light: "Light", "dark-a": "Dark · A", system: "System" };
    var TITLES = {
        light: "Today's site",
        "dark-a": "Proposal A: dark site, charts stay light",
        system: "Follow the operating system (dark uses proposal A)"
    };
    var PALETTE_LABELS = { current: "Current", midnight: "Midnight", slate: "Slate", ink: "Ink" };
    var PALETTE_TITLES = {
        current: "The palette as reviewed so far",
        midnight: "Deeper, more saturated navy; warm gold; classic red",
        slate: "Blue-green slate; a cleaner yellow; coral red",
        ink: "Indigo-tinted ink; soft peach-gold; rose red"
    };

    function group(label, options, labels, titles, selected, onPick) {
        var g = document.createElement("div");
        g.className = "theme-switcher__group";
        g.setAttribute("role", "group");
        g.setAttribute("aria-label", label);
        options.forEach(function (o) {
            var b = document.createElement("button");
            b.type = "button";
            b.className = "theme-switcher__option";
            b.textContent = labels[o];
            b.title = titles[o];
            b.setAttribute("aria-pressed", String(o === selected));
            b.addEventListener("click", function () { onPick(o); });
            g.appendChild(b);
        });
        return g;
    }

    var el;
    function render() {
        if (!el) return;
        el.innerHTML = "";
        el.appendChild(group("Color theme (prototype)", MODES, LABELS, TITLES, mode, window.__owidSetTheme));
        if (isDark()) {
            el.appendChild(group("Dark palette (prototype)", PALETTES, PALETTE_LABELS, PALETTE_TITLES, palette, window.__owidSetDarkPalette));
        }
    }
    function mount() {
        el = document.createElement("div");
        el.className = "theme-switcher";
        document.body.appendChild(el);
        render();
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
    else mount();
})();`

export const ThemeScript = () => (
    <script dangerouslySetInnerHTML={{ __html: themeScript }} />
)
