// ============================================================
// subject.js
// Drives a single subject's page. Expects a global
// SUBJECT_CONFIG = { name: "...", dataFile: "..." }
// to be defined in the page's inline <script> before this
// file loads.
// ============================================================

(async function () {

    const questions = await fetchQuestions(SUBJECT_CONFIG.dataFile);


    // ============================================================
    // Coverage charts (concepts + theorems), weighted by number
    // of terms each question has appeared in — same convention
    // as the original vault.
    // ============================================================

    function buildCoverage(field) {

        const counts = {};
        let total = 0;

        for (const q of questions) {

            const weight = Math.max(1, (q.terms || []).length);
            total += weight;

            for (const value of (q[field] || [])) {
                counts[value] = (counts[value] ?? 0) + weight;
            }
        }

        if (field === "theorems") {

            const noTheoremWeight = questions
                .filter(q => !q.theorems || q.theorems.length === 0)
                .reduce((sum, q) => sum + Math.max(1, (q.terms || []).length), 0);

            counts["No Major Theorems Used (Only using definitions)"] = noTheoremWeight;
        }

        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .map(([label, count]) => ({
                label,
                count,
                coverage: total === 0 ? "0%" : `${Math.round(100 * count / total)}%`
            }));
    }

    renderBarChart(document.getElementById("concept-chart"), buildCoverage("concepts"));
    renderBarChart(document.getElementById("theorem-chart"), buildCoverage("theorems"));


    // ============================================================
    // Sortable / searchable / concept-filtered table (AND logic)
    // ============================================================

    const tableConceptValues = [...new Set(questions.flatMap(q => q.concepts || []))].sort();
    const tableConceptCheckboxes = createCheckboxSection(
        document.getElementById("table-filter-container"),
        "Filter by Concepts",
        tableConceptValues,
        () => renderTable()
    );

    const tableNameSearch = document.getElementById("table-name-search");
    tableNameSearch.oninput = () => renderTable();

    const tableContainer = document.getElementById("question-table-container");

    let sortColumn = "id";
    let sortAscending = true;

    function parseTerm(term) {
        const match = String(term).match(/(Winter|Spring|Fall)\s+(\d{4})/i);
        if (!match) return null;
        const order = { winter: 1, spring: 2, fall: 3 };
        return Number(match[2]) * 10 + order[match[1].toLowerCase()];
    }

    function termSortValue(terms, ascending) {
        if (!terms || terms.length === 0) return Infinity;
        const parsed = terms.map(parseTerm).filter(t => t !== null);
        if (parsed.length === 0) return Infinity;
        return ascending ? Math.min(...parsed) : Math.max(...parsed);
    }

    function getFilteredQuestions() {

        const selectedConcepts = tableConceptCheckboxes.filter(c => c.checked).map(c => c.value);
        const nameQuery = tableNameSearch.value.trim().toLowerCase();
        const nameTerms = nameQuery === "" ? [] : nameQuery.split(/\s+/);

        return questions.filter(q => {

            if (selectedConcepts.length > 0) {
                const concepts = q.concepts || [];
                if (!selectedConcepts.every(c => concepts.includes(c))) return false;
            }

            if (nameTerms.length > 0) {
                const idLower = q.id.toLowerCase();
                if (!nameTerms.every(t => idLower.includes(t))) return false;
            }

            return true;
        });
    }

    function renderTable() {

        const filtered = getFilteredQuestions();

        const sorted = [...filtered].sort((a, b) => {

            if (sortColumn === "terms") {
                const x = termSortValue(a.terms, sortAscending);
                const y = termSortValue(b.terms, sortAscending);
                return sortAscending ? x - y : y - x;
            }

            let x, y;

            if (sortColumn === "id") { x = a.id; y = b.id; }
            else if (sortColumn === "concepts") { x = (a.concepts || []).join(", "); y = (b.concepts || []).join(", "); }
            else { x = String(a[sortColumn] ?? ""); y = String(b[sortColumn] ?? ""); }

            const cmp = x.localeCompare(y, undefined, { numeric: true, sensitivity: "base" });
            return sortAscending ? cmp : -cmp;
        });

        tableContainer.replaceChildren();

        if (sorted.length === 0) {
            const msg = document.createElement("div");
            msg.className = "muted-italic";
            msg.textContent = "No questions found.";
            tableContainer.appendChild(msg);
            return;
        }

        const table = document.createElement("table");
        const header = table.insertRow();

        const columns = [
            ["Question", "id"],
            ["University", "university"],
            ["Terms", "terms"],
            ["Difficulty", "difficulty"],
            ["Concepts", "concepts"]
        ];

        for (const [label, field] of columns) {
            const th = document.createElement("th");
            th.textContent = label;
            th.onclick = () => {
                if (sortColumn === field) sortAscending = !sortAscending;
                else { sortColumn = field; sortAscending = true; }
                renderTable();
            };
            header.appendChild(th);
        }

        for (const q of sorted) {

            const row = table.insertRow();

            const qCell = row.insertCell();
            const link = document.createElement("a");
            link.href = "#";
            link.textContent = q.id;
            link.onclick = (e) => { e.preventDefault(); openStatementModal(q); };
            qCell.appendChild(link);

            row.insertCell().textContent = q.university ?? "";
            row.insertCell().textContent = (q.terms || []).join(", ");
            row.insertCell().textContent = q.difficulty ?? "";
            row.insertCell().textContent = (q.concepts || []).join(", ");
        }

        tableContainer.appendChild(table);
    }

    renderTable();


    // ============================================================
    // Random Question Generator (OR logic across concepts/theorems)
    // ============================================================

    const genConceptValues = [...new Set(questions.flatMap(q => q.concepts || []))].sort();
    const genTheoremValues = [...new Set(questions.flatMap(q => q.theorems || []))].sort();
    const genWriterValues = [...new Set(questions.flatMap(q => q.writer || []))]
        .filter(w => w.toLowerCase() !== "unknown")
        .sort();

    const genContainer = document.getElementById("generator-container");

    const genConceptCheckboxes = createCheckboxSection(genContainer, "Select Concepts", genConceptValues, () => updateCount());
    const genTheoremCheckboxes = createCheckboxSection(genContainer, "Select Theorems", genTheoremValues, () => updateCount());

    const writerLabel = document.createElement("div");
    writerLabel.style.fontWeight = "bold";
    writerLabel.style.marginBottom = "8px";
    writerLabel.textContent = "Select Author";
    genContainer.appendChild(writerLabel);

    const writerSelect = document.createElement("select");
    writerSelect.style.display = "block";
    writerSelect.style.marginBottom = "15px";
    const anyWriterOpt = document.createElement("option");
    anyWriterOpt.value = "";
    anyWriterOpt.textContent = "Any Author";
    writerSelect.appendChild(anyWriterOpt);
    for (const w of genWriterValues) {
        const opt = document.createElement("option");
        opt.value = w;
        opt.textContent = w;
        writerSelect.appendChild(opt);
    }
    writerSelect.onchange = () => updateCount();
    genContainer.appendChild(writerSelect);

    const difficultyLabel = document.createElement("div");
    difficultyLabel.style.fontWeight = "bold";
    difficultyLabel.style.marginBottom = "8px";
    difficultyLabel.textContent = "Difficulty";
    genContainer.appendChild(difficultyLabel);

    const difficultyRow = document.createElement("div");
    difficultyRow.className = "control-row";

    const comparisonSelect = document.createElement("select");
    for (const [value, label] of [["equal", "Equal to"], ["atLeast", "At least"], ["atMost", "At most"]]) {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = label;
        comparisonSelect.appendChild(opt);
    }
    comparisonSelect.onchange = () => updateCount();

    const difficultyInput = document.createElement("input");
    difficultyInput.type = "number";
    difficultyInput.min = "1";
    difficultyInput.max = "5";
    difficultyInput.placeholder = "1–5";
    difficultyInput.style.width = "70px";
    difficultyInput.oninput = () => updateCount();

    difficultyRow.appendChild(comparisonSelect);
    difficultyRow.appendChild(difficultyInput);
    genContainer.appendChild(difficultyRow);

    const finishedLabel = document.createElement("div");
    finishedLabel.style.fontWeight = "bold";
    finishedLabel.style.marginBottom = "8px";
    finishedLabel.textContent = "Question has Written Solution";
    genContainer.appendChild(finishedLabel);

    const finishedSelect = document.createElement("select");
    finishedSelect.style.display = "block";
    finishedSelect.style.marginBottom = "15px";
    for (const [value, label] of [["any", "Any"], ["finished", "Full Solution"], ["unfinished", "Incomplete Solution"]]) {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = label;
        finishedSelect.appendChild(opt);
    }
    finishedSelect.onchange = () => updateCount();
    genContainer.appendChild(finishedSelect);

    const counterDisplay = document.createElement("div");
    counterDisplay.className = "muted-italic";
    counterDisplay.style.marginBottom = "12px";
    genContainer.appendChild(counterDisplay);

    const quantityRow = document.createElement("div");
    quantityRow.className = "control-row";
    const quantityLabel = document.createElement("span");
    quantityLabel.textContent = "Number of questions:";
    const quantityInput = document.createElement("input");
    quantityInput.type = "number";
    quantityInput.min = "1";
    quantityInput.value = "1";
    quantityInput.style.width = "60px";
    quantityInput.oninput = () => {
        const raw = quantityInput.value.trim();
        if (raw === "") return;
        const parsed = parseInt(raw, 10);
        if (!Number.isInteger(parsed) || parsed < 1) quantityInput.value = "1";
    };
    quantityInput.onblur = () => {
        if (quantityInput.value.trim() === "") quantityInput.value = "1";
    };
    quantityRow.appendChild(quantityLabel);
    quantityRow.appendChild(quantityInput);
    genContainer.appendChild(quantityRow);

    const findButton = document.createElement("button");
    findButton.textContent = "Find Random Question(s)";
    findButton.style.marginBottom = "12px";
    genContainer.appendChild(findButton);

    const genResult = document.createElement("div");
    genContainer.appendChild(genResult);

    renderGeneratorInstructions(genContainer);

    function getMatchingQuestions() {

        const selectedConcepts = genConceptCheckboxes.filter(c => c.checked).map(c => c.value);
        const selectedTheorems = genTheoremCheckboxes.filter(c => c.checked).map(c => c.value);
        const selectedWriter = writerSelect.value;

        const difficultyRaw = difficultyInput.value.trim();
        let difficulty = null;
        let invalid = false;

        if (difficultyRaw !== "") {
            difficulty = Number(difficultyRaw);
            if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) invalid = true;
        }

        if (invalid) return { matches: [], invalid: true };

        const matches = questions.filter(q => {

            const concepts = q.concepts || [];
            const theorems = q.theorems || [];

            const conceptsMatch = selectedConcepts.some(c => concepts.includes(c));
            const theoremsMatch = selectedTheorems.some(t => theorems.includes(t));

            if (!(conceptsMatch || theoremsMatch ||
                (selectedConcepts.length === 0 && selectedTheorems.length === 0))) {
                return false;
            }

            if (selectedWriter !== "") {
                if (!(q.writer || []).includes(selectedWriter)) return false;
            }

            if (finishedSelect.value !== "any") {
                const isFinished = !!q.finished;
                if (finishedSelect.value === "finished" && !isFinished) return false;
                if (finishedSelect.value === "unfinished" && isFinished) return false;
            }

            if (difficulty !== null) {
                const d = q.difficulty;
                if (d == null || Number.isNaN(Number(d))) return false;
                if (comparisonSelect.value === "equal" && Number(d) !== difficulty) return false;
                if (comparisonSelect.value === "atLeast" && Number(d) < difficulty) return false;
                if (comparisonSelect.value === "atMost" && Number(d) > difficulty) return false;
            }

            return true;
        });

        return { matches, invalid: false };
    }

    function updateCount() {
        const { matches, invalid } = getMatchingQuestions();
        if (invalid) {
            counterDisplay.textContent = "Enter a difficulty between 1 and 5.";
            return;
        }
        counterDisplay.textContent = matches.length === 1
            ? "1 question matches your filters."
            : `${matches.length} questions match your filters.`;
    }

    updateCount();

    findButton.onclick = () => {

        const { matches, invalid } = getMatchingQuestions();

        genResult.replaceChildren();

        if (invalid) {
            genResult.innerHTML = `<div class="muted-italic">Please enter a difficulty between 1 and 5.</div>`;
            return;
        }

        if (matches.length === 0) {
            genResult.innerHTML = `<div class="muted-italic">No questions available with the given constraints.</div>`;
            return;
        }

        let requested = parseInt(quantityInput.value, 10);
        if (!Number.isInteger(requested) || requested < 1) requested = 1;

        const shuffled = [...matches];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        const selectedCount = Math.min(requested, shuffled.length);
        const selected = shuffled.slice(0, selectedCount);

        if (selectedCount < requested) {
            const notice = document.createElement("div");
            notice.className = "muted-italic";
            notice.style.marginBottom = "8px";
            notice.textContent = `Only ${selectedCount} question${selectedCount === 1 ? "" : "s"} matched your filters (you asked for ${requested}).`;
            genResult.appendChild(notice);
        }

        const list = document.createElement("ul");
        list.className = "result-list";

        for (const q of selected) {
            const item = document.createElement("li");
            const link = document.createElement("a");
            link.href = "#";
            link.textContent = q.id;
            link.onclick = (e) => { e.preventDefault(); openStatementModal(q); };
            item.appendChild(link);
            list.appendChild(item);
        }

        genResult.appendChild(list);
    };

})();
