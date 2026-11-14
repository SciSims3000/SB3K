const RESULTS_ENDPOINT =
    "https://script.google.com/macros/s/AKfycbyxn8eNICoQrmQei-WsbTm8HqE4WQFz-dX1eTmgkbp4eu5mhFZAWwL6NAMlvHbSUhqzOg/exec";

const PLATFORM_VERSION =
    "0.4.5";

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
let submissionConfirmed = false;
const LEGACY_SESSION_KEY = "sb3k-session-v1";
const DEFAULT_ACTIVITY_ID = "demo-science-7-1";
const activityParams = new URLSearchParams(location.search);
let selectedActivityId = activityParams.get("activity");
const assignedClass = selectedActivityId && activityParams.get("mode") === "homework"
    ? (activityParams.get("class") ?? "").trim().slice(0, 40)
    : "";
let sessionStorageKey;
let homeworkKey;
let identifyingStudent = false;

function getSessionStorageKey() {
    return LEGACY_SESSION_KEY + ":" + selectedActivityId +
        (assignedClass ? ":homework:" + encodeURIComponent(assignedClass) : "");
}

const student = {
    studentId: "",
    name: "",
    className: "",
    identificationMethod: ""
};

let studentResponses = [];

/* ===== PLATFORM VERSION ===== */

updateVisiblePlatformVersion();

function updateVisiblePlatformVersion() {
    const versionElement =
        document.querySelector(
            ".footer-text strong"
        );

    if (versionElement) {
        versionElement.textContent =
            "StudyBuddy 3000 Prototype v" +
            PLATFORM_VERSION;
    }

    console.log(
        "SB3K Prototype v" +
        PLATFORM_VERSION
    );
}

/* ===== ACTIVITY LOADING ===== */

loadActivity();

async function loadActivity() {
    try {
        const manifest = await fetchJson("activities/manifest.json");
        const entries = manifest.activities;
        const entry = selectedActivityId === null
            ? entries[0]
            : entries.find(item => item.id === selectedActivityId);

        renderActivityPicker(entries, entry);
        if (!entry) throw new Error("This activity is unavailable.");

        selectedActivityId = entry.id;
        sessionStorageKey = getSessionStorageKey();
        if (restoreSession()) return;

        const data = await fetchJson(entry.path);
        if (data.activityId !== entry.id) {
            throw new Error("Activity ID does not match the manifest.");
        }
        activity = assignedClass ? { ...data, mode: "homework" } : data;
        renderActivityHeading();
    } catch (error) {
        selectedActivityId ??= DEFAULT_ACTIVITY_ID;
        sessionStorageKey ??= getSessionStorageKey();
        if (!activity && restoreSession()) return;

        document.getElementById("activityTitle").textContent = "Activity unavailable";
        document.getElementById("activityInfo").textContent =
            "Choose another activity or refresh to try again.";
        console.error("Activity loading error:", error);
    }
}

async function fetchJson(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error("Activity request failed: " + response.status);
    return response.json();
}

function renderActivityPicker(entries, entry) {
    const picker = document.getElementById("activityPicker");
    const select = document.getElementById("activitySelect");

    for (const item of entries) {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = [item.title, item.subject, item.yearLevel]
            .filter(Boolean)
            .join(" • ");
        select.appendChild(option);
    }

    select.value = entry?.id ?? "";
    picker.classList.toggle("hidden", Boolean(assignedClass));
    const builder = document.getElementById("homeworkLinkBuilder");
    builder.classList.toggle("hidden", Boolean(assignedClass) || !entry);
    if (!assignedClass && entry) {
        builder.addEventListener("submit", event => {
            event.preventDefault();
            const className = document.getElementById("homeworkClass").value.trim();
            if (!className) return;

            const url = new URL(location.href);
            url.search = new URLSearchParams({ activity: entry.id, mode: "homework", class: className });
            url.hash = "";
            const output = document.getElementById("homeworkLink");
            output.value = url.href;
            output.classList.remove("hidden");
            output.focus();
            output.select();
        });
    }
    select.addEventListener("change", () => {
        const url = new URL(location.href);
        url.searchParams.set("activity", select.value);
        location.assign(url);
    });
}

function renderActivityHeading() {
    const homework = activity.mode === "homework";
    const idInput = document.getElementById("studentId");
    idInput.inputMode = homework ? "numeric" : "text";
    idInput.required = homework;
    document.getElementById("studentIdOptional").classList.toggle("hidden", homework);
    document.getElementById("alternativeIdentification").classList.toggle("hidden", homework);
    if (homework) {
        document.getElementById("entryHelp").textContent =
            "Enter your five-digit ZipGrade Student ID. Use the same ID to resume in this browser.";
    }

    document.getElementById("activityTitle").textContent = activity.title;
    document.getElementById("activityInfo").textContent =
        activity.subject + " • " + activity.yearLevel + " • " + activity.topic +
        (assignedClass ? " • Homework • " + assignedClass : "");
}

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

async function startActivity() {
    if (identifyingStudent) return;
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

    const classInput = assignedClass ||
        document
            .getElementById("studentClass")
            .value
            .trim();

    const errorBox =
        document.getElementById(
            "entryError"
        );

    if (!selectedActivityId || !sessionStorageKey) {
        errorBox.textContent =
            "Activity is still loading. Please wait a moment.";

        return;
    }

    if ((assignedClass || activity?.mode === "homework") && !/^[0-9]{5}$/.test(studentIdInput)) {
        errorBox.textContent = "Enter your five-digit ZipGrade Student ID.";
        return;
    }

    const hasStudentId =
        studentIdInput.length > 0;

    const hasNameAndClass =
        nameInput.length > 0 &&
        classInput.length > 0;

    if (
        !hasStudentId &&
        !hasNameAndClass
    ) {
        errorBox.textContent =
            "Enter your Student ID, or enter both your name and class.";

        return;
    }

    identifyingStudent = true;
    try {
        const identity = hasStudentId
            ? ["id", studentIdInput.toLowerCase()]
            : ["name", nameInput.toLowerCase(), classInput.toLowerCase()];
        const digest = await crypto.subtle.digest("SHA-256",
            new TextEncoder().encode(JSON.stringify(assignedClass ? [selectedActivityId, identity, assignedClass] : [selectedActivityId, identity])));
        homeworkKey = "sb3k-homework:" + Array.from(new Uint8Array(digest),
            byte => byte.toString(16).padStart(2, "0")).join("");
    } catch {
        homeworkKey = null;
    } finally {
        identifyingStudent = false;
    }

    if (homeworkKey && restoreSession(homeworkKey)) return;
    if (!activity) {
        errorBox.textContent = "This activity needs a connection to start.";
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
    saveSession();

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

    showQuestion(
        currentQuestionIndex
    );
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
    submissionConfirmed = false;

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

function saveSession() {
    try {
        const snapshot = JSON.stringify({
            activity,
            activityQuestions,
            currentQuestionIndex,
            selectedAnswer,
            score,
            sessionId,
            sessionStartedAt,
            sessionCompletedAt,
            student,
            studentResponses,
            finalResultPacket,
            submissionConfirmed,
            homeworkKey
        });
        sessionStorage.setItem(sessionStorageKey, snapshot);
        if (!assignedClass && selectedActivityId === DEFAULT_ACTIVITY_ID) {
            sessionStorage.removeItem(LEGACY_SESSION_KEY);
        }
        if (homeworkKey) {
            if (submissionConfirmed) {
                localStorage.removeItem(homeworkKey);
            } else {
                localStorage.setItem(homeworkKey, snapshot);
                return "browser";
            }
        }
    } catch {
        // Fall back to same-tab recovery if persistent storage is unavailable.
    }

    try {
        return sessionStorage.getItem(sessionStorageKey) ? "tab" : false;
    } catch {
        return false;
    }
}

function restoreSession(persistentKey) {
    let saved;
    try {
        const stored = sessionStorage.getItem(sessionStorageKey);
        const legacy = !assignedClass && selectedActivityId === DEFAULT_ACTIVITY_ID
            ? sessionStorage.getItem(LEGACY_SESSION_KEY)
            : null;
        saved = JSON.parse(persistentKey ? localStorage.getItem(persistentKey) : stored ?? legacy);
    } catch {
        return;
    }

    if (saved?.activity?.activityId !== selectedActivityId || !saved.sessionId) {
        return;
    }

    // Keep the original activity and shuffle order across content updates.
    ({
        activity, activityQuestions, currentQuestionIndex, selectedAnswer,
        score, sessionId, sessionStartedAt, sessionCompletedAt,
        studentResponses, finalResultPacket, submissionConfirmed
    } = saved);
    homeworkKey = saved.homeworkKey ?? persistentKey;
    Object.assign(student, saved.student);
    renderActivityHeading();
    saveSession();

    document.getElementById("studentEntry").classList.add("hidden");

    if (currentQuestionIndex >= activityQuestions.length) {
        showResults();
        return true;
    }

    const savedAnswer = selectedAnswer;
    document.getElementById("questionArea").classList.remove("hidden");
    showQuestion(currentQuestionIndex);
    document.querySelectorAll(".answer-button").forEach(button => {
        if (button.textContent === savedAnswer) button.click();
    });

    const response = studentResponses[currentQuestionIndex];
    if (response) renderAnswerFeedback(activityQuestions[currentQuestionIndex], response.isCorrect);
    return true;
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
        .getElementById(
            "revisionSection"
        )
        .classList.add("hidden");

    resetSubmissionStatus();
}

function prepareActivityQuestions() {
    activityQuestions =
        cloneData(
            activity.questions
        );

    const shuffleQuestions =
        activity.settings
            ?.shuffleQuestions === true;

    const shuffleOptions =
        activity.settings
            ?.shuffleOptions === true;

    if (shuffleQuestions) {
        shuffleArray(
            activityQuestions
        );
    }

    if (shuffleOptions) {
        activityQuestions.forEach(
            question => {
                if (
                    Array.isArray(
                        question.options
                    )
                ) {
                    shuffleArray(
                        question.options
                    );
                }
            }
        );
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
        return structuredClone(
            data
        );
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

    const stimulus = document.getElementById("questionStimulus");
    stimulus.replaceChildren();
    if (question.image) {
        const image = document.createElement("img");
        image.alt = question.image.alt;
        image.addEventListener("error", () => {
            if (image.parentNode !== stimulus) return;
            stimulus.replaceChildren(document.createTextNode(question.image.alt));
        }, { once: true });
        stimulus.appendChild(image);
        image.src = question.image.src;

        if (question.image.caption) {
            const caption = document.createElement("figcaption");
            caption.textContent = question.image.caption;
            stimulus.appendChild(caption);
        }
    }

    const answerArea =
        document.getElementById(
            "answerArea"
        );

    answerArea.innerHTML = "";

    question.options.forEach(
        option => {
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
                    saveSession();
                }
            );

            answerArea.appendChild(
                button
            );
        }
    );

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

    if (studentResponses[currentQuestionIndex]) return;

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
        sessionId:
            sessionId,

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

    saveSession();
    renderAnswerFeedback(question, isCorrect);
}

function renderAnswerFeedback(question, isCorrect) {
    const feedbackBox = document.getElementById("feedbackBox");
    const submitButton = document.getElementById("submitAnswerButton");

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
        feedbackBox.textContent = "";

        feedbackBox.className =
            "feedback-box hidden";

        submitButton.disabled = true;

        submitButton.textContent =
            currentQuestionIndex ===
            activityQuestions.length - 1
                ? "Preparing Results..."
                : "Loading Next Question...";

        window.setTimeout(
            nextQuestion,
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

    selectedAnswer = null;
    saveSession();
    showQuestion(
        currentQuestionIndex
    );
}

/* ===== RESULTS ===== */

function showResults() {
    sessionCompletedAt ||= new Date().toISOString();

    document
        .getElementById(
            "questionArea"
        )
        .classList.add("hidden");

    document
        .getElementById(
            "resultsArea"
        )
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

    const passingPercentage =
        Number(
            activity.settings
                ?.passingPercentage ?? 50
        );

    const passFail =
        percentage >=
        passingPercentage
            ? "Pass"
            : "Not Yet";

    const questionsCorrect =
        studentResponses.filter(
            response =>
                response.isCorrect
        ).length;

    const questionsAttempted =
        studentResponses.length;

    const questionsIncorrect =
        questionsAttempted -
        questionsCorrect;

    const displayName =
        student.name ||
        student.studentId ||
        "Student";

    const identificationText =
        student
            .identificationMethod ===
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

    finalResultPacket ||=
        buildResultPacket({
            totalMarks:
                totalMarks,

            percentage:
                percentage,

            performance:
                performanceMessage,

            passFail:
                passFail,

            questionsCorrect:
                questionsCorrect,

            questionsIncorrect:
                questionsIncorrect,

            questionsAttempted:
                questionsAttempted,

            curriculumResults:
                curriculumResults
        });

    saveSession();

    if (submissionConfirmed) {
        showSubmissionConfirmed();
    } else {
        submitResultPacket(finalResultPacket);
    }
}

/* ===== GOOGLE SHEETS SUBMISSION ===== */

document.getElementById("retrySubmissionButton").addEventListener("click", () => {
    submitResultPacket(finalResultPacket);
});

let retryAfterReconnect = false;

window.addEventListener("online", () => {
    if (!finalResultPacket || submissionConfirmed) return;

    if (submissionInProgress) {
        retryAfterReconnect = true;
    } else {
        submitResultPacket(finalResultPacket);
    }
});

function showSubmissionConfirmed() {
    document.getElementById("tryAgainButton").disabled = false;
    document.getElementById("returnStartButton").disabled = false;
    setSubmissionStatus(
        "success",
        "Results sent",
        "Your results have been saved to Google Sheets."
    );
}

async function submitResultPacket(packet) {
    if (submissionInProgress || submissionConfirmed || !packet) return;

    submissionInProgress = true;
    const retryButton = document.getElementById("retrySubmissionButton");
    retryButton.classList.add("hidden");
    document.getElementById("tryAgainButton").disabled = true;
    document.getElementById("returnStartButton").disabled = true;
    const saved = saveSession();

    setSubmissionStatus(
        "sending",
        "Sending results…",
        "Please keep this page open while your results are sent."
    );

    try {
        const readiness = await fetch(RESULTS_ENDPOINT + "?sb3k=protocol", {
            cache: "no-store",
            signal: AbortSignal.timeout(10000)
        });
        if (!readiness.ok || (await readiness.json()).submissionProtocol !== 1) {
            throw new Error("Acknowledged submissions are unavailable");
        }

        const response = await fetch(RESULTS_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(packet),
            signal: AbortSignal.timeout(20000)
        });
        if (!response.ok) throw new Error("Submission response failed");

        const receipt = await response.json();
        if (receipt.saved !== true || receipt.sessionId !== packet.session.id) {
            throw new Error("Submission was not acknowledged");
        }

        submissionConfirmed = true;
        saveSession();
        showSubmissionConfirmed();
    } catch {
        setSubmissionStatus(
            "error",
            "Results not yet confirmed",
            saved === "browser"
                ? "Results are saved in this browser. Retry now, or reopen this activity and enter the same student details."
                : saved
                ? "Your results are saved in this tab. Try sending again before closing it."
                : "Keep this page open and try sending again. Browser storage is unavailable."
        );
        retryButton.classList.remove("hidden");
    } finally {
        submissionInProgress = false;
        if (retryAfterReconnect) {
            retryAfterReconnect = false;
            if (!submissionConfirmed) submitResultPacket(packet);
        }
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

    statusBox.className =
        "submission-status " +
        state;

    document.getElementById(
        "submissionStatusTitle"
    ).textContent =
        title;

    document.getElementById(
        "submissionStatusMessage"
    ).textContent =
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
    passFail,
    questionsCorrect,
    questionsIncorrect,
    questionsAttempted,
    curriculumResults
}) {
    return {
        schemaVersion:
            "1.1",

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
                performance,

            passFail:
                passFail,

            questionsCorrect:
                questionsCorrect,

            questionsIncorrect:
                questionsIncorrect,

            questionsAttempted:
                questionsAttempted,

            curriculumOutcomes:
                curriculumResults.length
        },

        device:
            getDeviceInformation(),

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

function getDeviceInformation() {
    return {
        browser:
            getBrowserName(),

        platform:
            navigator.userAgentData
                ?.platform ||
            navigator.platform ||
            "Unknown",

        screenResolution:
            window.screen.width +
            " × " +
            window.screen.height
    };
}

function getBrowserName() {
    const userAgent =
        navigator.userAgent;

    if (
        userAgent.includes("Edg/")
    ) {
        return "Microsoft Edge";
    }

    if (
        userAgent.includes("Chrome/")
    ) {
        return "Google Chrome";
    }

    if (
        userAgent.includes("Firefox/")
    ) {
        return "Mozilla Firefox";
    }

    if (
        userAgent.includes("Safari/") &&
        !userAgent.includes("Chrome/")
    ) {
        return "Safari";
    }

    return "Other";
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

        titleGroup.appendChild(name);
        titleGroup.appendChild(code);

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
    if (!submissionConfirmed) return;
    resetQuizState();
    createNewSession();
    prepareActivityQuestions();
    saveSession();

    document
        .getElementById(
            "resultsArea"
        )
        .classList.add("hidden");

    document
        .getElementById(
            "questionArea"
        )
        .classList.remove("hidden");

    showQuestion(
        currentQuestionIndex
    );
}

function returnToStart() {
    if (!submissionConfirmed) return;

    try {
        sessionStorage.removeItem(sessionStorageKey);
        homeworkKey = null;
    } catch {
        // Storage can be disabled by the browser.
    }
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
        .getElementById(
            "questionArea"
        )
        .classList.add("hidden");

    document
        .getElementById(
            "resultsArea"
        )
        .classList.add("hidden");

    document
        .getElementById(
            "studentEntry"
        )
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
