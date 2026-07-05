let activity = null;
let currentQuestionIndex = 0;
let selectedAnswer = null;

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

    const checkButton = document.createElement("button");
    checkButton.textContent = "Check Answer";
    checkButton.id = "checkAnswerButton";
    checkButton.addEventListener("click", checkAnswer);

    answerArea.appendChild(checkButton);

    const feedbackBox = document.createElement("div");
    feedbackBox.id = "feedbackBox";
    feedbackBox.classList.add("feedback-box", "hidden");

    answerArea.appendChild(feedbackBox);
}

function checkAnswer() {
    const question = activity.questions[currentQuestionIndex];
    const feedbackBox = document.getElementById("feedbackBox");

    if (!selectedAnswer) {
        feedbackBox.textContent = "Please select an answer before checking.";
        feedbackBox.className = "feedback-box warning";
        feedbackBox.classList.remove("hidden");
        return;
    }

    const isCorrect = selectedAnswer === question.answer;

    if (isCorrect) {
        feedbackBox.textContent = "Correct. " + question.feedback;
        feedbackBox.className = "feedback-box correct";
    } else {
        feedbackBox.textContent =
            "Not quite. The correct answer is: " +
            question.answer +
            ". " +
            question.feedback;

        feedbackBox.className = "feedback-box incorrect";
    }

    feedbackBox.classList.remove("hidden");
}
