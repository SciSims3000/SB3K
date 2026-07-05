let activity = null;
let currentQuestionIndex = 0;
let selectedAnswer = null;
let score = 0;

const student = {
    name: "",
    className: ""
};

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

    document.getElementById("questionProgress").textContent =
        "Question " + (index + 1) + " of " + activity.questions.length;

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

    if (isCorrect) {
        score++;
    }

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

    const percentage = Math.round((score / activity.questions.length) * 100);

    document.getElementById("resultsSummary").innerHTML =
        "<strong>" + student.name + "</strong><br>" +
        "Class: " + student.className + "<br><br>" +
        "Score: <strong>" + score + " / " + activity.questions.length + "</strong><br>" +
        "Percentage: <strong>" + percentage + "%</strong>";
}
