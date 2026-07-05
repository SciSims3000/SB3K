let activity = null;

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

    showQuestion(0);
}

function showQuestion(index) {
    const question = activity.questions[index];

    document.getElementById("questionProgress").textContent =
        "Question " + (index + 1) + " of " + activity.questions.length;

    document.getElementById("questionText").textContent = question.question;

    const answerArea = document.getElementById("answerArea");
    answerArea.innerHTML = "";

    question.options.forEach(option => {
        const button = document.createElement("button");
        button.textContent = option;
        answerArea.appendChild(button);
    });
}
