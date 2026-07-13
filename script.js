function submitAnswer() {
    const question =
        activityQuestions[currentQuestionIndex];

    const feedbackBox =
        document.getElementById("feedbackBox");

    const submitButton =
        document.getElementById("submitAnswerButton");

    if (!selectedAnswer) {
        feedbackBox.textContent =
            "Please select an answer before submitting.";

        feedbackBox.className =
            "feedback-box warning";

        feedbackBox.classList.remove("hidden");

        return;
    }

    const feedbackSettings =
        activity.settings?.feedback || {};

    const showImmediateFeedback =
        feedbackSettings.afterEachQuestion !== false;

    const showCorrectAnswers =
        feedbackSettings.showCorrectAnswers !== false;

    const showExplanations =
        feedbackSettings.showExplanations !== false;

    const isCorrect =
        selectedAnswer === question.answer;

    const marksAwarded =
        isCorrect
            ? question.marks
            : 0;

    if (isCorrect) {
        score += question.marks;
    }

    studentResponses.push({
        questionId: question.id,
        questionText: question.question,
        selectedAnswer: selectedAnswer,
        correctAnswer: question.answer,
        isCorrect: isCorrect,
        marksAwarded: marksAwarded,
        marksAvailable: question.marks,
        curriculum: question.curriculum || []
    });

    console.table(studentResponses);

    document
        .querySelectorAll(".answer-button")
        .forEach(button => {
            button.disabled = true;

            if (!showImmediateFeedback) {
                button.classList.remove("selected");
                return;
            }

            if (
                showCorrectAnswers &&
                button.textContent === question.answer
            ) {
                button.classList.add("correct-answer");
            }

            if (
                button.textContent === selectedAnswer &&
                selectedAnswer !== question.answer
            ) {
                button.classList.add("incorrect-answer");
            }
        });

    if (!showImmediateFeedback) {
        feedbackBox.textContent = "";
        feedbackBox.className = "feedback-box hidden";

        submitButton.disabled = true;
        submitButton.textContent =
            currentQuestionIndex ===
            activityQuestions.length - 1
                ? "Preparing Results..."
                : "Loading Next Question...";

        window.setTimeout(() => {
            nextQuestion();
        }, 250);

        return;
    }

    if (isCorrect) {
        feedbackBox.innerHTML =
            "<strong>Correct!</strong>" +
            (
                showExplanations &&
                question.feedback
                    ? "<br>" +
                      escapeHtml(question.feedback)
                    : ""
            );

        feedbackBox.className =
            "feedback-box correct";
    } else {
        let feedbackHtml =
            "<strong>Not quite.</strong>";

        if (showCorrectAnswers) {
            feedbackHtml +=
                "<br>The correct answer is: <strong>" +
                escapeHtml(question.answer) +
                "</strong>";
        }

        if (
            showExplanations &&
            question.feedback
        ) {
            feedbackHtml +=
                "<br>" +
                escapeHtml(question.feedback);
        }

        feedbackBox.innerHTML =
            feedbackHtml;

        feedbackBox.className =
            "feedback-box incorrect";
    }

    feedbackBox.classList.remove("hidden");

    submitButton.textContent =
        currentQuestionIndex ===
        activityQuestions.length - 1
            ? "Show Results"
            : "Next Question";

    submitButton.removeEventListener(
        "click",
        submitAnswer
    );

    submitButton.addEventListener(
        "click",
        nextQuestion
    );
}
