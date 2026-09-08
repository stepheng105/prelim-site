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

    // Minimal paragraph-splitting; the statement text itself
    // is left otherwise as-is (LaTeX delimiters preserved for
    // KaTeX to pick up).
    const paragraphs = question.statement.split(/\n\s*\n/);
    for (const p of paragraphs) {
        const pEl = document.createElement("p");
        pEl.textContent = p.trim();
        statement.appendChild(pEl);
    }

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
            ]
        });
    }
}
