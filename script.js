let activity = null;
let currentQuestionIndex = 0;
let selectedAnswer = null;
let score = 0;

const student = {
    name: "",
    className: ""
};

const studentResponses = [];

fetch("activities/demo-science-7-1.json")
    .then(response => response.json())
    .then(data => {
        activity = data;

        document.getElementById("activityTitle").textContent = activity.title;

        document.getElementById("activityInfo").textContent =
            activity.subject +
            " • " +
            activity.yearLevel +
            " • " +
            activity.topic;
    })
    .catch(error => {
        console.error(error);
        document.getElementById("activityTitle").textContent = "Activity could not be loaded.";
    });

document.getElementById("startButton").addEventListener("click", startActivity);

function startActivity() {
    const nameInput = document.getElementById("studentName").value.trim();
    const classInput = document.getElementById("studentClass").value.trim();
    const errorBox = document.getElementById("entryError");

    if (!activity) {
        errorBox.textContent = "Activity is still loading. Please wait a moment.";
        return;
    }

    if (!nameInput || !classInput) {
        errorBox.textContent = "Please enter your name and class before starting.";
        return;
    }

    student.name = nameInput;
    student.className = classInput;

    errorBox.textContent = "";

    document.getElementById("studentEntry").classList.add("hidden");
    document.getElementById("questionArea").classList.remove("hidden");

    showQuestion(currentQuestionIndex);
}

function showQuestion(index) {
    selectedAnswer = null;

    const question = activity.questions[index];

    const current = index + 1;
    const total = activity.questions.length;
    const percent = Math.round((current / total) * 100);

    document.getElementById("questionProgress").textContent =
        "Question " + current + " of " + total;

    document.getElementById("progressPercent").textContent =
        percent + "%";

    document.getElementById("progressFill").style.width =
        percent + "%";

    document.getElementById("questionText").textContent = question.question;

    const answerArea = document.getElementById("answerArea");
    answerArea.innerHTML = "";

    question.options.forEach(option => {
        const button = document.createElement("button");
        button.textContent = option;
        button.classList.add("answer-button");

        button.addEventListener("click", () => {
            selectedAnswer = option;

            document.querySelectorAll(".answer-button").forEach(btn => {
                btn.classList.remove("selected");
            });

            button.classList.add("selected");
        });

        answerArea.appendChild(button);
    });

    const submitButton = document.createElement("button");
    submitButton.textContent = "Submit Answer";
    submitButton.id = "submitAnswerButton";
    submitButton.addEventListener("click", submitAnswer);

    answerArea.appendChild(submitButton);

    const feedbackBox = document.createElement("div");
    feedbackBox.id = "feedbackBox";
    feedbackBox.classList.add("feedback-box", "hidden");

    answerArea.appendChild(feedbackBox);
}

function submitAnswer() {
    const question = activity.questions[currentQuestionIndex];
    const feedbackBox = document.getElementById("feedbackBox");
    const submitButton = document.getElementById("submitAnswerButton");

    if (!selectedAnswer) {
        feedbackBox.textContent = "Please select an answer before submitting.";
        feedbackBox.className = "feedback-box warning";
        feedbackBox.classList.remove("hidden");
        return;
    }

    const isCorrect = selectedAnswer === question.answer;
    const marksAwarded = isCorrect ? question.marks : 0;

    if (isCorrect) {
        score += question.marks;
    }

    const responseRecord = {
        questionId: question.id,
        questionText: question.question,
        selectedAnswer: selectedAnswer,
        correctAnswer: question.answer,
        isCorrect: isCorrect,
        marksAwarded: marksAwarded,
        marksAvailable: question.marks,
        curriculum: question.curriculum || []
    };

    studentResponses.push(responseRecord);

    console.table(studentResponses);

    document.querySelectorAll(".answer-button").forEach(btn => {
        btn.disabled = true;

        if (btn.textContent === question.answer) {
            btn.classList.add("correct-answer");
        }

        if (btn.textContent === selectedAnswer && selectedAnswer !== question.answer) {
            btn.classList.add("incorrect-answer");
        }
    });

    if (isCorrect) {
        feedbackBox.innerHTML =
            "<strong>Correct!</strong><br>" +
            question.feedback;

        feedbackBox.className = "feedback-box correct";
    } else {
        feedbackBox.innerHTML =
            "<strong>Not quite.</strong><br>" +
            "The correct answer is: <strong>" +
            question.answer +
            "</strong><br>" +
            question.feedback;

        feedbackBox.className = "feedback-box incorrect";
    }

    feedbackBox.classList.remove("hidden");

    submitButton.textContent =
        currentQuestionIndex === activity.questions.length - 1
            ? "Show Results"
            : "Next Question";

    submitButton.removeEventListener("click", submitAnswer);
    submitButton.addEventListener("click", nextQuestion);
}

function nextQuestion() {
    currentQuestionIndex++;

    if (currentQuestionIndex >= activity.questions.length) {
        showResults();
        return;
    }

    showQuestion(currentQuestionIndex);
}

function showResults() {
    document.getElementById("questionArea").classList.add("hidden");
    document.getElementById("resultsArea").classList.remove("hidden");

    const totalMarks = activity.questions.reduce((total, question) => {
        return total + question.marks;
    }, 0);

    const percentage = Math.round((score / totalMarks) * 100);

    document.getElementById("resultsSummary").innerHTML =
        "<strong>" + student.name + "</strong><br>" +
        "Class: " + student.className + "<br><br>" +
        "Score: <strong>" + score + " / " + totalMarks + "</strong><br>" +
        "Percentage: <strong>" + percentage + "%</strong>";
}
