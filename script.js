const RESULTS_ENDPOINT =
    "https://script.google.com/macros/s/AKfycbyxESB79OXK5yIKgEEHxYi6QEUI3YSZ4UTvhe9uIFTDeDUU0LLsh5HHGIA90NYCY4wiSg/exec";

const PLATFORM_VERSION = "0.3.1";

let activity = null;
let activityQuestions = [];

let currentQuestionIndex = 0;
let selectedAnswer = null;
let score = 0;

let sessionId = "";
let sessionStartedAt = "";
let sessionCompletedAt = "";

let finalResultPacket = null;
let submissionInProgress = false;

const student = {
    studentId: "",
    name: "",
    className: "",
    identificationMethod: ""
};

let studentResponses = [];

/* ===== ACTIVITY LOADING ===== */

fetch("activities/demo-science-7-1.json")
    .then(response => {
        if (!response.ok) {
            throw new Error(
                "Activity request failed with status " +
                response.status
            );
        }

        return response.json();
    })
    .then(data => {
        activity = data;

        document.getElementById("activityTitle").textContent =
            activity.title;

        document.getElementById("activityInfo").textContent =
            activity.subject +
            " • " +
            activity.yearLevel +
            " • " +
            activity.topic;
    })
    .catch(error => {
        console.error(
            "Activity loading error:",
            error
        );

        document.getElementById("activityTitle").textContent =
            "Activity could not be loaded.";

        document.getElementById("activityInfo").textContent =
            "Please refresh the page or contact your teacher.";
    });

/* ===== EVENT LISTENERS ===== */

document
    .getElementById("startButton")
    .addEventListener(
        "click",
        startActivity
    );

document
    .getElementById("tryAgainButton")
    .addEventListener(
        "click",
        tryAgain
    );

document
    .getElementById("returnStartButton")
    .addEventListener(
        "click",
        returnToStart
    );

/* ===== STUDENT ENTRY ===== */

function startActivity() {
    const studentIdInput =
        document
            .getElementById("studentId")
            .value
            .trim();

    const nameInput =
        document
            .getElementById("studentName")
            .value
            .trim();

    const classInput =
        document
            .getElementById("studentClass")
            .value
            .trim();

    const errorBox =
        document.getElementById("entryError");

    if (!activity) {
        errorBox.textContent =
            "Activity is still loading. Please wait a moment.";

        return;
    }

    const hasStudentId =
        studentIdInput.length > 0;

    const hasNameAndClass =
        nameInput.length > 0 &&
        classInput.length > 0;

    if (!hasStudentId && !hasNameAndClass) {
        errorBox.textContent =
            "Enter your Student ID, or enter both your name and class.";

        return;
    }

    student.studentId =
        studentIdInput;

    student.name =
        nameInput;

    student.className =
        classInput;

    student.identificationMethod =
        hasStudentId
            ? "studentId"
            : "nameAndClass";

    resetQuizState();
    createNewSession();
    prepareActivityQuestions();

    errorBox.textContent = "";

    document
        .getElementById("studentEntry")
        .classList.add("hidden");

    document
        .getElementById("resultsArea")
        .classList.add("hidden");

    document
        .getElementById("questionArea")
        .classList.remove("hidden");

    showQuestion(currentQuestionIndex);
}

/* ===== SESSION MANAGEMENT ===== */

function createNewSession() {
    sessionId =
        generateSessionId();

    sessionStartedAt =
        new Date().toISOString();

    sessionCompletedAt = "";
    finalResultPacket = null;
    submissionInProgress = false;

    console.log(
        "Session started:",
        sessionId
    );
}

function generateSessionId() {
    const datePart =
        new Date()
            .toISOString()
            .slice(0, 10)
            .replaceAll("-", "");

    const randomPart =
        Math.random()
            .toString(36)
            .slice(2, 8)
            .toUpperCase();

    return (
        "SB3K-" +
        datePart +
        "-" +
        randomPart
    );
}

/* ===== QUIZ SETUP ===== */

function resetQuizState() {
    currentQuestionIndex = 0;
    selectedAnswer = null;
    score = 0;

    activityQuestions = [];
    studentResponses = [];

    document.getElementById(
        "curriculumResults"
    ).innerHTML = "";

    document.getElementById(
        "revisionList"
    ).innerHTML = "";

    document
        .getElementById("revisionSection")
        .classList.add("hidden");

    resetSubmissionStatus();
}

function prepareActivityQuestions() {
    activityQuestions =
        cloneData(activity.questions);

    const shuffleQuestions =
        activity.settings
            ?.shuffleQuestions === true;

    const shuffleOptions =
        activity.settings
            ?.shuffleOptions === true;

    if (shuffleQuestions) {
        shuffleArray(activityQuestions);
    }

    if (shuffleOptions) {
        activityQuestions.forEach(question => {
            if (
                Array.isArray(
                    question.options
                )
            ) {
                shuffleArray(
                    question.options
                );
            }
        });
    }

    console.log(
        "Question order:",
        activityQuestions.map(
            question => question.id
        )
    );
}

function cloneData(data) {
    if (
        typeof structuredClone ===
        "function"
    ) {
        return structuredClone(data);
    }

    return JSON.parse(
        JSON.stringify(data)
    );
}

function shuffleArray(array) {
    for (
        let currentIndex =
            array.length - 1;

        currentIndex > 0;

        currentIndex--
    ) {
        const randomIndex =
            Math.floor(
                Math.random() *
                (currentIndex + 1)
            );

        [
            array[currentIndex],
            array[randomIndex]
        ] = [
            array[randomIndex],
            array[currentIndex]
        ];
    }

    return array;
}

/* ===== QUESTION ENGINE ===== */

function showQuestion(index) {
    selectedAnswer = null;

    const question =
        activityQuestions[index];

    const current =
        index + 1;

    const total =
        activityQuestions.length;

    const percent =
        Math.round(
            (current / total) * 100
        );

    document.getElementById(
        "questionProgress"
    ).textContent =
        "Question " +
        current +
        " of " +
        total;

    document.getElementById(
        "progressPercent"
    ).textContent =
        percent + "%";

    document.getElementById(
        "progressFill"
    ).style.width =
        percent + "%";

    document.getElementById(
        "questionText"
    ).textContent =
        question.question;

    const answerArea =
        document.getElementById(
            "answerArea"
        );

    answerArea.innerHTML = "";

    question.options.forEach(option => {
        const button =
            document.createElement(
                "button"
            );

        button.type =
            "button";

        button.textContent =
            option;

        button.classList.add(
            "answer-button"
        );

        button.addEventListener(
            "click",
            () => {
                selectedAnswer =
                    option;

                document
                    .querySelectorAll(
                        ".answer-button"
                    )
                    .forEach(
                        answerButton => {
                            answerButton
                                .classList
                                .remove(
                                    "selected"
                                );
                        }
                    );

                button.classList.add(
                    "selected"
                );
            }
        );

        answerArea.appendChild(
            button
        );
    });

    const submitButton =
        document.createElement(
            "button"
        );

    submitButton.type =
        "button";

    submitButton.textContent =
        "Submit Answer";

    submitButton.id =
        "submitAnswerButton";

    submitButton.addEventListener(
        "click",
        submitAnswer
    );

    answerArea.appendChild(
        submitButton
    );

    const feedbackBox =
        document.createElement(
            "div"
        );

    feedbackBox.id =
        "feedbackBox";

    feedbackBox.classList.add(
        "feedback-box",
        "hidden"
    );

    feedbackBox.setAttribute(
        "role",
        "status"
    );

    answerArea.appendChild(
        feedbackBox
    );
}

function submitAnswer() {
    const question =
        activityQuestions[
            currentQuestionIndex
        ];

    const feedbackBox =
        document.getElementById(
            "feedbackBox"
        );

    const submitButton =
        document.getElementById(
            "submitAnswerButton"
        );

    if (!selectedAnswer) {
        feedbackBox.textContent =
            "Please select an answer before submitting.";

        feedbackBox.className =
            "feedback-box warning";

        feedbackBox.classList.remove(
            "hidden"
        );

        return;
    }

    const feedbackSettings =
        activity.settings
            ?.feedback || {};

    const showImmediateFeedback =
        feedbackSettings
            .afterEachQuestion !== false;

    const showCorrectAnswers =
        feedbackSettings
            .showCorrectAnswers !== false;

    const showExplanations =
        feedbackSettings
            .showExplanations !== false;

    const isCorrect =
        selectedAnswer ===
        question.answer;

    const marksAwarded =
        isCorrect
            ? question.marks
            : 0;

    if (isCorrect) {
        score +=
            question.marks;
    }

    studentResponses.push({
        sessionId: sessionId,

        questionNumber:
            currentQuestionIndex + 1,

        questionId:
            question.id,

        questionText:
            question.question,

        selectedAnswer:
            selectedAnswer,

        correctAnswer:
            question.answer,

        isCorrect:
            isCorrect,

        marksAwarded:
            marksAwarded,

        marksAvailable:
            question.marks,

        curriculum:
            question.curriculum || []
    });

    console.table(
        studentResponses
    );

    document
        .querySelectorAll(
            ".answer-button"
        )
        .forEach(button => {
            button.disabled = true;

            if (
                !showImmediateFeedback
            ) {
                button.classList.remove(
                    "selected"
                );

                return;
            }

            if (
                showCorrectAnswers &&
                button.textContent ===
                    question.answer
            ) {
                button.classList.add(
                    "correct-answer"
                );
            }

            if (
                button.textContent ===
                    selectedAnswer &&
                selectedAnswer !==
                    question.answer
            ) {
                button.classList.add(
                    "incorrect-answer"
                );
            }
        });

    if (!showImmediateFeedback) {
        feedbackBox.textContent =
            "";

        feedbackBox.className =
            "feedback-box hidden";

        submitButton.disabled =
            true;

        submitButton.textContent =
            currentQuestionIndex ===
            activityQuestions.length - 1
                ? "Preparing Results..."
                : "Loading Next Question...";

        window.setTimeout(
            () => {
                nextQuestion();
            },
            250
        );

        return;
    }

    if (isCorrect) {
        feedbackBox.innerHTML =
            "<strong>Correct!</strong>" +
            (
                showExplanations &&
                question.feedback
                    ? "<br>" +
                      escapeHtml(
                          question.feedback
                      )
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
                escapeHtml(
                    question.answer
                ) +
                "</strong>";
        }

        if (
            showExplanations &&
            question.feedback
        ) {
            feedbackHtml +=
                "<br>" +
                escapeHtml(
                    question.feedback
                );
        }

        feedbackBox.innerHTML =
            feedbackHtml;

        feedbackBox.className =
            "feedback-box incorrect";
    }

    feedbackBox.classList.remove(
        "hidden"
    );

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

function nextQuestion() {
    currentQuestionIndex++;

    if (
        currentQuestionIndex >=
        activityQuestions.length
    ) {
        showResults();
        return;
    }

    showQuestion(
        currentQuestionIndex
    );
}

/* ===== RESULTS ===== */

function showResults() {
    sessionCompletedAt =
        new Date().toISOString();

    document
        .getElementById("questionArea")
        .classList.add("hidden");

    document
        .getElementById("resultsArea")
        .classList.remove("hidden");

    const totalMarks =
        activityQuestions.reduce(
            (total, question) =>
                total +
                question.marks,
            0
        );

    const percentage =
        totalMarks > 0
            ? Math.round(
                (
                    score /
                    totalMarks
                ) * 100
            )
            : 0;

    const performanceMessage =
        getPerformanceMessage(
            percentage
        );

    const displayName =
        student.name ||
        student.studentId ||
        "Student";

    const identificationText =
        student.identificationMethod ===
        "studentId"
            ? student.studentId
            : student.name +
              " • " +
              student.className;

    document.getElementById(
        "resultsGreeting"
    ).textContent =
        "Well done, " +
        displayName +
        "!";

    document.getElementById(
        "resultIdentity"
    ).textContent =
        identificationText;

    document.getElementById(
        "resultSession"
    ).textContent =
        sessionId;

    document.getElementById(
        "resultScore"
    ).textContent =
        score +
        " / " +
        totalMarks;

    document.getElementById(
        "resultPercentage"
    ).textContent =
        percentage + "%";

    document.getElementById(
        "resultPerformance"
    ).textContent =
        performanceMessage;

    const curriculumResults =
        calculateCurriculumResults();

    renderCurriculumResults(
        curriculumResults
    );

    renderRevisionSuggestions(
        curriculumResults
    );

    finalResultPacket =
        buildResultPacket({
            totalMarks:
                totalMarks,

            percentage:
                percentage,

            performance:
                performanceMessage,

            curriculumResults:
                curriculumResults
        });

    console.log(
        "SB3K result packet:",
        finalResultPacket
    );

    submitResultPacket(
        finalResultPacket
    );
}

/* ===== GOOGLE SHEETS SUBMISSION ===== */

async function submitResultPacket(packet) {
    if (
        submissionInProgress ||
        !packet
    ) {
        return;
    }

    submissionInProgress = true;

    setSubmissionStatus(
        "sending",
        "Sending results…",
        "Please keep this page open while your results are sent."
    );

    try {
        await fetch(
            RESULTS_ENDPOINT,
            {
                method: "POST",
                mode: "no-cors",
                headers: {
                    "Content-Type":
                        "text/plain;charset=utf-8"
                },
                body:
                    JSON.stringify(packet)
            }
        );

        setSubmissionStatus(
            "success",
            "Results sent",
            "Your results have been sent to your teacher."
        );

        console.log(
            "Result submission request sent:",
            packet.session.id
        );
    } catch (error) {
        console.error(
            "Result submission error:",
            error
        );

        setSubmissionStatus(
            "error",
            "Results could not be sent",
            "Keep this page open and ask your teacher for assistance."
        );
    } finally {
        submissionInProgress = false;
    }
}

function setSubmissionStatus(
    state,
    title,
    message
) {
    const statusBox =
        document.getElementById(
            "submissionStatus"
        );

    const titleElement =
        document.getElementById(
            "submissionStatusTitle"
        );

    const messageElement =
        document.getElementById(
            "submissionStatusMessage"
        );

    statusBox.className =
        "submission-status " +
        state;

    titleElement.textContent =
        title;

    messageElement.textContent =
        message;

    statusBox.classList.remove(
        "hidden"
    );
}

function resetSubmissionStatus() {
    const statusBox =
        document.getElementById(
            "submissionStatus"
        );

    statusBox.className =
        "submission-status hidden";

    document.getElementById(
        "submissionStatusTitle"
    ).textContent = "";

    document.getElementById(
        "submissionStatusMessage"
    ).textContent = "";
}

/* ===== RESULT PACKET ===== */

function buildResultPacket({
    totalMarks,
    percentage,
    performance,
    curriculumResults
}) {
    return {
        schemaVersion:
            "1.0",

        platformVersion:
            PLATFORM_VERSION,

        session: {
            id:
                sessionId,

            startedAt:
                sessionStartedAt,

            completedAt:
                sessionCompletedAt,

            durationSeconds:
                calculateSessionDuration()
        },

        activity: {
            id:
                activity.activityId,

            title:
                activity.title,

            subject:
                activity.subject,

            yearLevel:
                activity.yearLevel,

            topic:
                activity.topic,

            activityVersion:
                activity.version,

            mode:
                activity.mode
        },

        student: {
            studentId:
                student.studentId,

            name:
                student.name,

            className:
                student.className,

            identificationMethod:
                student.identificationMethod
        },

        result: {
            score:
                score,

            totalMarks:
                totalMarks,

            percentage:
                percentage,

            performance:
                performance
        },

        curriculumResults:
            curriculumResults,

        responses:
            studentResponses
    };
}

function calculateSessionDuration() {
    if (
        !sessionStartedAt ||
        !sessionCompletedAt
    ) {
        return 0;
    }

    const startTime =
        new Date(
            sessionStartedAt
        ).getTime();

    const endTime =
        new Date(
            sessionCompletedAt
        ).getTime();

    return Math.max(
        0,
        Math.round(
            (
                endTime -
                startTime
            ) / 1000
        )
    );
}

/* ===== CURRICULUM ANALYTICS ===== */

function calculateCurriculumResults() {
    const results = {};

    studentResponses.forEach(
        response => {
            response.curriculum.forEach(
                curriculumItem => {
                    const curriculumId =
                        curriculumItem.id;

                    if (
                        !results[
                            curriculumId
                        ]
                    ) {
                        results[
                            curriculumId
                        ] = {
                            id:
                                curriculumId,

                            name:
                                curriculumItem.name,

                            marksAwarded:
                                0,

                            marksAvailable:
                                0,

                            correctQuestions:
                                0,

                            totalQuestions:
                                0
                        };
                    }

                    results[
                        curriculumId
                    ].marksAwarded +=
                        response
                            .marksAwarded;

                    results[
                        curriculumId
                    ].marksAvailable +=
                        response
                            .marksAvailable;

                    results[
                        curriculumId
                    ].totalQuestions +=
                        1;

                    if (
                        response.isCorrect
                    ) {
                        results[
                            curriculumId
                        ].correctQuestions +=
                            1;
                    }
                }
            );
        }
    );

    return Object
        .values(results)
        .map(result => {
            const percentage =
                result.marksAvailable > 0
                    ? Math.round(
                        (
                            result.marksAwarded /
                            result.marksAvailable
                        ) * 100
                    )
                    : 0;

            return {
                ...result,
                percentage:
                    percentage
            };
        });
}

function renderCurriculumResults(
    results
) {
    const container =
        document.getElementById(
            "curriculumResults"
        );

    container.innerHTML = "";

    results.forEach(result => {
        const item =
            document.createElement(
                "article"
            );

        item.classList.add(
            "curriculum-result-item"
        );

        const headingRow =
            document.createElement(
                "div"
            );

        headingRow.classList.add(
            "curriculum-result-header"
        );

        const titleGroup =
            document.createElement(
                "div"
            );

        const name =
            document.createElement(
                "strong"
            );

        name.textContent =
            result.name;

        const code =
            document.createElement(
                "span"
            );

        code.classList.add(
            "curriculum-code"
        );

        code.textContent =
            result.id;

        titleGroup.appendChild(
            name
        );

        titleGroup.appendChild(
            code
        );

        const percentage =
            document.createElement(
                "strong"
            );

        percentage.classList.add(
            "curriculum-percentage"
        );

        percentage.textContent =
            result.percentage +
            "%";

        headingRow.appendChild(
            titleGroup
        );

        headingRow.appendChild(
            percentage
        );

        const detail =
            document.createElement(
                "p"
            );

        detail.classList.add(
            "curriculum-detail"
        );

        detail.textContent =
            result.correctQuestions +
            " of " +
            result.totalQuestions +
            " questions correct";

        const progressTrack =
            document.createElement(
                "div"
            );

        progressTrack.classList.add(
            "curriculum-progress-track"
        );

        const correctSection =
            document.createElement(
                "div"
            );

        correctSection.classList.add(
            "curriculum-progress-correct"
        );

        correctSection.style.width =
            result.percentage +
            "%";

        const incorrectSection =
            document.createElement(
                "div"
            );

        incorrectSection.classList.add(
            "curriculum-progress-incorrect"
        );

        incorrectSection.style.width =
            (
                100 -
                result.percentage
            ) + "%";

        progressTrack.appendChild(
            correctSection
        );

        progressTrack.appendChild(
            incorrectSection
        );

        item.appendChild(
            headingRow
        );

        item.appendChild(
            detail
        );

        item.appendChild(
            progressTrack
        );

        container.appendChild(
            item
        );
    });
}

function renderRevisionSuggestions(
    results
) {
    const revisionSection =
        document.getElementById(
            "revisionSection"
        );

    const revisionList =
        document.getElementById(
            "revisionList"
        );

    revisionList.innerHTML = "";

    const areasToRevise =
        results
            .filter(
                result =>
                    result.percentage <
                    75
            )
            .sort(
                (
                    first,
                    second
                ) =>
                    first.percentage -
                    second.percentage
            );

    if (
        areasToRevise.length === 0
    ) {
        revisionSection
            .classList
            .add("hidden");

        return;
    }

    areasToRevise.forEach(
        result => {
            const listItem =
                document.createElement(
                    "li"
                );

            listItem.innerHTML =
                "<strong>" +
                escapeHtml(
                    result.name
                ) +
                "</strong>" +
                " — " +
                result.percentage +
                "%";

            revisionList.appendChild(
                listItem
            );
        }
    );

    revisionSection
        .classList
        .remove("hidden");
}

/* ===== PERFORMANCE ===== */

function getPerformanceMessage(
    percentage
) {
    if (percentage >= 90) {
        return "Outstanding work";
    }

    if (percentage >= 75) {
        return "Great work";
    }

    if (percentage >= 50) {
        return "Good progress";
    }

    return "Keep practising";
}

/* ===== RESTART CONTROLS ===== */

function tryAgain() {
    resetQuizState();
    createNewSession();
    prepareActivityQuestions();

    document
        .getElementById("resultsArea")
        .classList.add("hidden");

    document
        .getElementById("questionArea")
        .classList.remove("hidden");

    showQuestion(
        currentQuestionIndex
    );
}

function returnToStart() {
    resetQuizState();

    sessionId = "";
    sessionStartedAt = "";
    sessionCompletedAt = "";
    finalResultPacket = null;
    submissionInProgress = false;

    student.studentId = "";
    student.name = "";
    student.className = "";
    student.identificationMethod = "";

    document.getElementById(
        "studentId"
    ).value = "";

    document.getElementById(
        "studentName"
    ).value = "";

    document.getElementById(
        "studentClass"
    ).value = "";

    document.getElementById(
        "entryError"
    ).textContent = "";

    document
        .getElementById("questionArea")
        .classList.add("hidden");

    document
        .getElementById("resultsArea")
        .classList.add("hidden");

    document
        .getElementById("studentEntry")
        .classList.remove("hidden");
}

/* ===== UTILITIES ===== */

function escapeHtml(value) {
    const element =
        document.createElement(
            "div"
        );

    element.textContent =
        value === undefined ||
        value === null
            ? ""
            : String(value);

    return element.innerHTML;
}
