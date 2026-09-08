// ============================================================
// home.js
// Drives the main hub page: aggregate progress bars +
// cross-subject random question generator.
// ============================================================

(async function () {

    const allQuestions = await fetchQuestions("assets/data/all-questions.json");

    const subjects = [...new Set(allQuestions.map(q => q.subject))];


    // ============================================================
    // Overall Progress (stacked bars, finished vs. not, per subject)
    // ============================================================

    const progressContainer = document.getElementById("progress-container");

    function renderProgressRow(container, name, finished, total, bold) {

        const row = document.createElement("div");
        row.className = "bar-row";

        const label = document.createElement("span");
        label.className = "bar-label";
        label.style.width = "220px";
        label.textContent = name;
        if (bold) label.style.fontWeight = "bold";

        const track = document.createElement("div");
        track.className = "bar-track";

        const finishedPct = total === 0 ? 0 : (finished / total) * 100;
        const unfinishedPct = total === 0 ? 0 : ((total - finished) / total) * 100;

        const finishedFill = document.createElement("div");
        finishedFill.className = "bar-fill";
        finishedFill.style.width = `${finishedPct}%`;

        const unfinishedFill = document.createElement("div");
        unfinishedFill.className = "bar-fill secondary";
        unfinishedFill.style.width = `${unfinishedPct}%`;

        track.appendChild(finishedFill);
        track.appendChild(unfinishedFill);

        const value = document.createElement("span");
        value.className = "bar-value";
        value.style.width = "160px";
        value.textContent = `${finished}/${total} have solutions`;
        if (bold) value.style.fontWeight = "bold";

        row.appendChild(label);
        row.appendChild(track);
        row.appendChild(value);

        container.appendChild(row);
    }

    const legend = document.createElement("div");
    legend.style.display = "flex";
    legend.style.gap = "16px";
    legend.style.fontSize = "0.85em";
    legend.style.color = "var(--text-muted)";
    legend.style.marginBottom = "10px";
    legend.innerHTML = `<span style="color:var(--accent)">■ Have Solutions</span><span>■ Missing Written Solution</span>`;
    progressContainer.appendChild(legend);

    const chart = document.createElement("div");
    chart.className = "bar-chart";
    progressContainer.appendChild(chart);

    let overallTotal = 0;
    let overallFinished = 0;

    for (const subject of subjects) {
        const qs = allQuestions.filter(q => q.subject === subject);
        const finished = qs.filter(q => q.finished).length;
        renderProgressRow(chart, subject, finished, qs.length, false);
        overallTotal += qs.length;
        overallFinished += finished;
    }

    const divider = document.createElement("hr");
    divider.style.border = "none";
    divider.style.borderTop = "1px solid var(--border)";
    chart.appendChild(divider);

    renderProgressRow(chart, "Overall", overallFinished, overallTotal, true);


    // ============================================================
    // Cross-Subject Random Question Generator
    // ============================================================

    const genContainer = document.getElementById("generator-container");

    const subjectTitle = document.createElement("div");
    subjectTitle.style.fontWeight = "bold";
    subjectTitle.style.marginBottom = "8px";
    subjectTitle.textContent = "Select Subjects";
    genContainer.appendChild(subjectTitle);

    const subjectRow = document.createElement("div");
    subjectRow.style.display = "flex";
    subjectRow.style.flexWrap = "wrap";
    subjectRow.style.gap = "6px 20px";
    subjectRow.style.marginBottom = "15px";

    const subjectCheckboxes = [];

    for (const subject of subjects) {
        const label = document.createElement("label");
        label.style.display = "flex";
        label.style.alignItems = "center";
        label.style.gap = "6px";

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = subject;
        cb.onchange = () => updateCount();

        const text = document.createElement("span");
        text.textContent = subject;

        label.appendChild(cb);
        label.appendChild(text);
        subjectRow.appendChild(label);
        subjectCheckboxes.push(cb);
    }

    genContainer.appendChild(subjectRow);

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

    function getMatching() {

        const selectedSubjects = subjectCheckboxes.filter(c => c.checked).map(c => c.value);

        const difficultyRaw = difficultyInput.value.trim();
        let difficulty = null;
        let invalid = false;

        if (difficultyRaw !== "") {
            difficulty = Number(difficultyRaw);
            if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) invalid = true;
        }

        if (invalid) return { matches: [], invalid: true };

        const matches = allQuestions.filter(q => {

            if (selectedSubjects.length > 0 && !selectedSubjects.includes(q.subject)) return false;

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
        const { matches, invalid } = getMatching();
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

        const { matches, invalid } = getMatching();

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
            link.textContent = `[${q.subject}] ${q.id}`;
            link.onclick = (e) => { e.preventDefault(); openStatementModal(q); };
            item.appendChild(link);
            list.appendChild(item);
        }

        genResult.appendChild(list);
    };

})();
