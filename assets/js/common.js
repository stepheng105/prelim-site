// ============================================================
// common.js
// Shared helpers used by every page on the site.
// No page-specific logic lives here.
// ============================================================

async function fetchQuestions(relativePath) {

    const response = await fetch(relativePath);

    if (!response.ok) {
        throw new Error(`Failed to load ${relativePath}: ${response.status}`);
    }

    return response.json();
}

// ------------------------------------------------------------
// Dark mode: applied immediately so there's no flash of the
// wrong theme. Respects system preference by default; an
// explicit toggle choice is remembered in localStorage and
// takes precedence over system preference from then on.
// ------------------------------------------------------------

(function () {
    const stored = localStorage.getItem("theme"); // "light" | "dark" | null
    if (stored === "light" || stored === "dark") {
        document.documentElement.setAttribute("data-theme", stored);
    }
})();


// ------------------------------------------------------------
// Defensive normalizers (data should already be clean coming
// out of extract.js, but these cost nothing and guard against
// any future data hiccups)
// ------------------------------------------------------------

function toArraySafe(x) {
    if (x == null) return [];
    return Array.isArray(x) ? x : [x];
}

function normalizeSafe(x) {
    if (x == null) return null;
    return String(x).trim();
}


// ------------------------------------------------------------
// Checkbox filter section: collapsible, searchable, with
// Select All / Clear All. Returns the array of checkbox
// elements so callers can read .checked / .value.
// ------------------------------------------------------------

function createCheckboxSection(container, title, values, onChange) {

    const details = document.createElement("details");
    details.className = "filter-section";

    const summary = document.createElement("summary");
    summary.textContent = title;
    details.appendChild(summary);

    const controlsRow = document.createElement("div");
    controlsRow.className = "filter-controls-row";

    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.placeholder = `Search ${title.toLowerCase()}...`;
    controlsRow.appendChild(searchInput);

    const selectAllButton = document.createElement("button");
    selectAllButton.textContent = "Select All";
    controlsRow.appendChild(selectAllButton);

    const clearButton = document.createElement("button");
    clearButton.textContent = "Clear All";
    controlsRow.appendChild(clearButton);

    details.appendChild(controlsRow);

    const grid = document.createElement("div");
    grid.className = "checkbox-grid";
    details.appendChild(grid);

    const checkboxes = [];
    const entries = [];

    for (const value of values) {

        const label = document.createElement("label");

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = value;
        checkbox.onchange = onChange;

        const text = document.createElement("span");
        text.textContent = value;

        label.appendChild(checkbox);
        label.appendChild(text);
        grid.appendChild(label);

        checkboxes.push(checkbox);
        entries.push({ label, checkbox, value: value.toLowerCase() });
    }

    searchInput.oninput = () => {
        const query = searchInput.value.trim().toLowerCase();
        for (const { label, value } of entries) {
            label.style.display = value.includes(query) ? "flex" : "none";
        }
    };

    selectAllButton.onclick = () => {
        for (const { label, checkbox } of entries) {
            if (label.style.display !== "none") checkbox.checked = true;
        }
        onChange();
    };

    clearButton.onclick = () => {
        for (const checkbox of checkboxes) checkbox.checked = false;
        onChange();
    };

    container.appendChild(details);

    return checkboxes;
}


// ------------------------------------------------------------
// Horizontal bar chart. `rows` is an array of
// { label, count, coverage } sorted however the caller wants.
// ------------------------------------------------------------

function renderBarChart(container, rows) {

    container.replaceChildren();

    const chart = document.createElement("div");
    chart.className = "bar-chart";

    const maxCount = Math.max(...rows.map(r => r.count), 1);

    for (const row of rows) {

        const rowEl = document.createElement("div");
        rowEl.className = "bar-row";

        const label = document.createElement("span");
        label.className = "bar-label";
        label.textContent = row.label;

        const track = document.createElement("div");
        track.className = "bar-track";

        const fill = document.createElement("div");
        fill.className = "bar-fill";
        fill.style.width = `${(row.count / maxCount) * 100}%`;
        track.appendChild(fill);

        const value = document.createElement("span");
        value.className = "bar-value";
        value.textContent = `${row.count} (${row.coverage})`;

        rowEl.appendChild(label);
        rowEl.appendChild(track);
        rowEl.appendChild(value);

        chart.appendChild(rowEl);
    }

    container.appendChild(chart);
}


// ------------------------------------------------------------
// KaTeX macros, mirroring the vault's preamble.sty.
//
// KaTeX macro strings support #1, #2, ... argument placeholders
// directly (no special numArgs wrapper needed) — the number of
// arguments is inferred from the highest #N used.
//
// NOTE: \null is already a built-in KaTeX/TeX primitive (an
// invisible zero-width box). Redefining it here shadows that
// primitive rather than adding a new command — this matches
// the vault's preamble as written, but is worth knowing about
// if \null is ever needed in its original TeX sense.
//
// This object is created once and reused across every
// katex render call, per KaTeX's own guidance for macro
// persistence (see katex.org/docs/api).
// ------------------------------------------------------------

const KATEX_MACROS = {
    "\\norm": "\\left\\vert\\left\\vert #1 \\right\\vert\\right\\vert",
    "\\inp": "\\langle #1, #2 \\rangle",
    "\\Res": "\\operatorname{Res}\\left( #1, #2 \\right)",
    "\\spn": "\\operatorname{Span}\\left(#1 \\right)",
    "\\null": "\\operatorname{Null}\\left(#1 \\right)",
    "\\abs": "\\left|#1 \\right|",
    "\\R": "\\mathbb{R}",
    "\\Q": "\\mathbb{Q}",
    "\\C": "\\mathbb{C}",
    "\\F": "\\mathbb{F}",
    "\\N": "\\mathbb{N}",
    "\\Z": "\\mathbb{Z}",
    "\\T": "\\mathbb{T}",
    "\\D": "\\mathbb{D}",
    "\\contradiction": "\\Rightarrow\\!\\Leftarrow"
};

// ------------------------------------------------------------
// Static usage instructions for the random question generator.
// Same content on every subject page.
// ------------------------------------------------------------

function renderGeneratorInstructions(container) {

    const wrapper = document.createElement("div");
    wrapper.className = "instructions-block";

    wrapper.innerHTML = `
        <h3>Instructions for Random Question Generator</h3>

        <p><strong>TLDR:</strong></p>
        <ul>
            <li>Choose concepts and theorems and it will find question(s) that have at least one of those concepts/theorems.</li>
            <li>Author, difficulty, and written solution constraints will force the question to have the requested author, difficulty, and solution status.</li>
        </ul>

        <details>
            <summary><strong>Full Instructions</strong></summary>
            <ul>
                <li><strong>Select Concepts / Select Theorems:</strong>
                    <ul>
                        <li>These sections are dropdowns to a large number of tick boxes. If you select no tick boxes in either section, no filter is applied (i.e., it just picks a random question).</li>
                        <li>If you select some tick boxes (e.g. "Metric Spaces" and "Connectedness" under concepts, and "Baire Category Theorem" under theorems), it will find a question with at least one of those concepts OR theorems.</li>
                        <li>These dropdowns also have "Select All" and "Clear All" buttons, useful if you have only a few topics you DON'T want to study, or want to clear all filters at once.</li>
                    </ul>
                </li>
                <li><strong>Select Author:</strong>
                    <ul>
                        <li>Lets you filter by author. Choose "Any Author," or a specific author of that portion of the exams.</li>
                        <li>This forces all results to have been written by that specific author.</li>
                        <li>Some authors have only written a few exams, so filtering by them may yield only a couple results.</li>
                    </ul>
                </li>
                <li><strong>Select Difficulty:</strong>
                    <ul>
                        <li>Two pieces: a dropdown for "Equal to," "At least," or "At most," and a numerical input between 1 and 5 (1 = easiest, 5 = hardest). This forces all generated questions to satisfy the constraint.</li>
                        <li>Example: selecting "At least" and entering 3 generates only questions with difficulty ≥ 3.</li>
                        <li>Leaving the input box empty applies no difficulty filter.</li>
                    </ul>
                </li>
                <li><strong>Question has Written Solution:</strong>
                    <ul>
                        <li>Lets you filter by solution status. "Any" applies no filter; "Full Solution" generates only questions with a written solution; "Incomplete Solution" generates only questions without one.</li>
                    </ul>
                </li>
                <li><strong>Number of questions:</strong>
                    <ul>
                        <li>Generates multiple distinct questions at once (minimum 1).</li>
                        <li>Entering 1 generates a single question; entering 5 generates 5 distinct questions, as long as 5 match your filters.</li>
                        <li>If you request more than the number of matching questions, you'll get all available matches.</li>
                    </ul>
                </li>
            </ul>
        </details>
    `;

    container.appendChild(wrapper);
}


// ------------------------------------------------------------
// Renders a statement's text, grouping consecutive "part"
// lines — (a), (b), 1., i., etc. — into a tightly-spaced
// block instead of full paragraphs, regardless of whether the
// source separated them with blank lines or plain newlines.
// ------------------------------------------------------------

function renderStatementBody(container, rawText) {

    const PART_MARKER = /^\s*\(?[a-zA-Z0-9]+[\.\)]\s+/;

    const lines = rawText.split("\n");

    let currentParagraph = [];
    const blocks = [];

    function flushParagraph() {
        if (currentParagraph.length > 0) {
            blocks.push({ type: "paragraph", text: currentParagraph.join(" ").trim() });
            currentParagraph = [];
        }
    }

    for (const line of lines) {

        const trimmed = line.trim();

        if (trimmed === "") {
            flushParagraph();
            continue;
        }

        if (PART_MARKER.test(trimmed)) {
            flushParagraph();
            blocks.push({ type: "part", text: trimmed });
            continue;
        }

        currentParagraph.push(trimmed);
    }

    flushParagraph();

    let i = 0;

    while (i < blocks.length) {

        if (blocks[i].type === "part") {

            const partsGroup = document.createElement("div");
            partsGroup.className = "statement-parts";

            while (i < blocks.length && blocks[i].type === "part") {
                const partEl = document.createElement("p");
                partEl.className = "statement-part";
                partEl.textContent = blocks[i].text;
                partsGroup.appendChild(partEl);
                i++;
            }

            container.appendChild(partsGroup);

        } else {

            const p = document.createElement("p");
            p.textContent = blocks[i].text;
            container.appendChild(p);
            i++;
        }
    }
}


// ------------------------------------------------------------
// Statement modal: shows a question's metadata + public
// problem statement (Markdown-ish text with LaTeX). Renders
// math via KaTeX auto-render if it's loaded on the page.
// ------------------------------------------------------------

function openStatementModal(question) {

    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";

    const box = document.createElement("div");
    box.className = "modal-box";

    const closeBtn = document.createElement("button");
    closeBtn.className = "modal-close";
    closeBtn.textContent = "×";
    closeBtn.onclick = () => backdrop.remove();

    const title = document.createElement("h3");
    title.textContent = `${question.university ?? ""} ${question.terms?.join(", ") ?? ""}`.trim() || question.id;

    const meta = document.createElement("div");
    meta.className = "modal-meta";
    const metaParts = [];
    if (question.difficulty != null) metaParts.push(`Difficulty: ${question.difficulty}`);
    if (question.concepts?.length) metaParts.push(`Concepts: ${question.concepts.join(", ")}`);
    if (question.theorems?.length) metaParts.push(`Theorems: ${question.theorems.join(", ")}`);
    if (question.writer?.length) metaParts.push(`Author: ${question.writer.join(", ")}`);
    meta.textContent = metaParts.join(" • ");

    const statement = document.createElement("div");
    statement.className = "statement-body";

    renderStatementBody(statement, question.statement);

    box.appendChild(closeBtn);
    box.appendChild(title);
    box.appendChild(meta);
    box.appendChild(statement);
    backdrop.appendChild(box);

    backdrop.onclick = (e) => {
        if (e.target === backdrop) backdrop.remove();
    };

    document.body.appendChild(backdrop);

    // Render math if KaTeX's auto-render extension is present on the page
    if (window.renderMathInElement) {
        window.renderMathInElement(box, {
            delimiters: [
                { left: "$$", right: "$$", display: true },
                { left: "$", right: "$", display: false }
            ],
            macros: KATEX_MACROS,
            throwOnError: false
        });
    }
}

// ------------------------------------------------------------
// Inserts a dark/light toggle button into the nav bar on every
// page (no per-page HTML changes needed, since every page
// already loads common.js and has a nav.top-nav element).
// ------------------------------------------------------------

function initThemeToggle() {

    const nav = document.querySelector("nav.top-nav");
    if (!nav) return;

    const button = document.createElement("button");
    button.className = "theme-toggle";
    button.type = "button";

    function currentTheme() {
        const explicit = document.documentElement.getAttribute("data-theme");
        if (explicit) return explicit;
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }

    function updateLabel() {
        button.textContent = currentTheme() === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode";
    }

    updateLabel();

    button.onclick = () => {
        const next = currentTheme() === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", next);
        localStorage.setItem("theme", next);
        updateLabel();
    };

    nav.appendChild(button);
}

initThemeToggle();