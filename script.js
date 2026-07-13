function renderCurriculumResults(results) {
    const container =
        document.getElementById("curriculumResults");

    container.innerHTML = "";

    results.forEach(result => {
        const item =
            document.createElement("article");

        item.classList.add(
            "curriculum-result-item"
        );

        const headingRow =
            document.createElement("div");

        headingRow.classList.add(
            "curriculum-result-header"
        );

        const titleGroup =
            document.createElement("div");

        const name =
            document.createElement("strong");

        name.textContent =
            result.name;

        const code =
            document.createElement("span");

        code.classList.add(
            "curriculum-code"
        );

        code.textContent =
            result.id;

        titleGroup.appendChild(name);
        titleGroup.appendChild(code);

        const percentage =
            document.createElement("strong");

        percentage.classList.add(
            "curriculum-percentage"
        );

        percentage.textContent =
            result.percentage + "%";

        headingRow.appendChild(titleGroup);
        headingRow.appendChild(percentage);

        const detail =
            document.createElement("p");

        detail.classList.add(
            "curriculum-detail"
        );

        detail.textContent =
            result.correctQuestions +
            " of " +
            result.totalQuestions +
            " questions correct";

        const progressTrack =
            document.createElement("div");

        progressTrack.classList.add(
            "curriculum-progress-track"
        );

        const correctSection =
            document.createElement("div");

        correctSection.classList.add(
            "curriculum-progress-correct"
        );

        correctSection.style.width =
            result.percentage + "%";

        const incorrectSection =
            document.createElement("div");

        incorrectSection.classList.add(
            "curriculum-progress-incorrect"
        );

        incorrectSection.style.width =
            (100 - result.percentage) + "%";

        progressTrack.appendChild(correctSection);
        progressTrack.appendChild(incorrectSection);

        item.appendChild(headingRow);
        item.appendChild(detail);
        item.appendChild(progressTrack);

        container.appendChild(item);
    });
}
