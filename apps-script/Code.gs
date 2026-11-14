const SUBMISSIONS_SHEET = "Submissions";
const CURRICULUM_SHEET = "Curriculum Results";
const RESPONSES_SHEET = "Question Responses";

const SUBMISSION_HEADERS = [
  "Received Timestamp",
  "Session ID",
  "Session Started",
  "Session Completed",
  "Duration (Seconds)",
  "Activity ID",
  "Activity Title",
  "Subject",
  "Year Level",
  "Topic",
  "Activity Version",
  "Mode",
  "Student ID",
  "Student Name",
  "Class",
  "Identification Method",
  "Score",
  "Total Marks",
  "Percentage",
  "Performance",
  "Pass/Fail",
  "Questions Correct",
  "Questions Incorrect",
  "Questions Attempted",
  "Curriculum Outcomes",
  "Browser",
  "Platform",
  "Screen Resolution",
  "Submitted Successfully",
  "Revision Difficulty",
  "Revision Length",
  "Questions Shown"
];

const CURRICULUM_HEADERS = [
  "Received Timestamp",
  "Session ID",
  "Activity ID",
  "Activity Title",
  "Activity Version",
  "Mode",
  "Student ID",
  "Student Name",
  "Class",
  "Curriculum ID",
  "Curriculum Name",
  "Marks Awarded",
  "Marks Available",
  "Questions Correct",
  "Questions Attempted",
  "Percentage"
];

const RESPONSE_HEADERS = [
  "Received Timestamp",
  "Session ID",
  "Activity ID",
  "Activity Title",
  "Activity Version",
  "Mode",
  "Student ID",
  "Student Name",
  "Class",
  "Question Number",
  "Question ID",
  "Question Text",
  "Selected Answer",
  "Correct Answer",
  "Correct?",
  "Marks Awarded",
  "Marks Available",
  "Curriculum IDs",
  "Curriculum Names",
  "Question Difficulty"
];

function doGet() {
  return createJsonResponse({
    success: true,
    service: "SB3K Results Receiver",
    version: "0.3.7",
    submissionProtocol: 1,
    message: "The SB3K results receiver is running.",
    timestamp: new Date().toISOString()
  });
}

function doPost(e) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);

    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("No submission data was received.");
    }

    const packet = JSON.parse(e.postData.contents);

    validatePacket(packet);

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const receivedTimestamp = new Date();

    const submissionsSheet = getOrCreateSheet(
      spreadsheet,
      SUBMISSIONS_SHEET,
      SUBMISSION_HEADERS
    );

    const curriculumSheet = getOrCreateSheet(
      spreadsheet,
      CURRICULUM_SHEET,
      CURRICULUM_HEADERS
    );

    const responsesSheet = getOrCreateSheet(
      spreadsheet,
      RESPONSES_SHEET,
      RESPONSE_HEADERS
    );

    const sessionId = packet.session.id;

    // Resume missing detail rows even for a legacy submission whose summary
    // was written before an interrupted request.
    appendCurriculumRows(curriculumSheet, packet, receivedTimestamp);
    appendResponseRows(responsesSheet, packet, receivedTimestamp);
    SpreadsheetApp.flush();

    if (findSessionRows(submissionsSheet, sessionId).length === 0) {
      appendSubmissionRow(submissionsSheet, packet, receivedTimestamp);
    }

    SpreadsheetApp.flush();

    return createJsonResponse({
      success: true,
      saved: true,
      sessionId: packet.session.id,
      message: "SB3K results saved successfully."
    });
  } catch (error) {
    console.error(error);

    return createJsonResponse({
      success: false,
      message:
        error && error.message
          ? error.message
          : "The submission could not be saved."
    });
  } finally {
    try {
      lock.releaseLock();
    } catch (error) {
      console.warn(
        "The script lock could not be released.",
        error
      );
    }
  }
}

function getOrCreateSheet(
  spreadsheet,
  sheetName,
  requiredHeaders
) {
  let sheet =
    spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet =
      spreadsheet.insertSheet(sheetName);
  }

  ensureHeaders(
    sheet,
    requiredHeaders
  );

  return sheet;
}

function ensureHeaders(
  sheet,
  requiredHeaders
) {
  const currentLastColumn =
    Math.max(sheet.getLastColumn(), 1);

  const existingHeaders =
    sheet
      .getRange(1, 1, 1, currentLastColumn)
      .getValues()[0]
      .map(value => String(value).trim())
      .filter(value => value !== "");

  if (existingHeaders.length === 0) {
    sheet
      .getRange(
        1,
        1,
        1,
        requiredHeaders.length
      )
      .setValues([requiredHeaders]);
  } else {
    const missingHeaders =
      requiredHeaders.filter(
        header =>
          !existingHeaders.includes(header)
      );

    if (missingHeaders.length > 0) {
      const startColumn =
        existingHeaders.length + 1;

      sheet
        .getRange(
          1,
          startColumn,
          1,
          missingHeaders.length
        )
        .setValues([missingHeaders]);
    }
  }

  const finalLastColumn =
    sheet.getLastColumn();

  sheet
    .getRange(
      1,
      1,
      1,
      finalLastColumn
    )
    .setFontWeight("bold");

  sheet.setFrozenRows(1);
}

function findSessionRows(sheet, sessionId, keyHeader) {
  const width = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, width).getValues()[0];
  const sessionColumn = headers.indexOf("Session ID") + 1;
  const keyColumn = keyHeader ? headers.indexOf(keyHeader) + 1 : sessionColumn;
  const rowCount = sheet.getLastRow() - 1;

  if (!sessionColumn || !keyColumn) {
    throw new Error("Missing submission tracking column.");
  }
  if (rowCount === 0) return [];

  return sheet.getRange(2, sessionColumn, rowCount, 1)
    .createTextFinder(sessionId)
    .matchEntireCell(true)
    .matchCase(true)
    .findAll()
    .map(cell => String(sheet.getRange(cell.getRow(), keyColumn).getValue()));
}

function appendSubmissionRow(
  sheet,
  packet,
  receivedTimestamp
) {
  const rowData = {
    "Received Timestamp":
      receivedTimestamp,

    "Session ID":
      safeValue(packet.session?.id),

    "Session Started":
      safeValue(packet.session?.startedAt),

    "Session Completed":
      safeValue(packet.session?.completedAt),

    "Duration (Seconds)":
      safeValue(packet.session?.durationSeconds),

    "Activity ID":
      safeValue(packet.activity?.id),

    "Activity Title":
      safeValue(packet.activity?.title),

    "Subject":
      safeValue(packet.activity?.subject),

    "Year Level":
      safeValue(packet.activity?.yearLevel),

    "Topic":
      safeValue(packet.activity?.topic),

    "Activity Version":
      safeValue(packet.activity?.activityVersion),

    "Mode":
      safeValue(packet.activity?.mode),

    "Student ID":
      safeValue(packet.student?.studentId),

    "Student Name":
      safeValue(packet.student?.name),

    "Class":
      safeValue(packet.student?.className),

    "Identification Method":
      safeValue(
        packet.student?.identificationMethod
      ),

    "Score":
      safeValue(packet.result?.score),

    "Total Marks":
      safeValue(packet.result?.totalMarks),

    "Percentage":
      safeValue(packet.result?.percentage),

    "Performance":
      safeValue(packet.result?.performance),

    "Pass/Fail":
      safeValue(packet.result?.passFail),

    "Questions Correct":
      safeValue(
        packet.result?.questionsCorrect
      ),

    "Questions Incorrect":
      safeValue(
        packet.result?.questionsIncorrect
      ),

    "Questions Attempted":
      safeValue(
        packet.result?.questionsAttempted
      ),

    "Curriculum Outcomes":
      safeValue(
        packet.result?.curriculumOutcomes
      ),

    "Browser":
      safeValue(packet.device?.browser),

    "Platform":
      safeValue(packet.device?.platform),

    "Screen Resolution":
      safeValue(
        packet.device?.screenResolution
      ),

    "Revision Difficulty": safeValue(packet.revision?.difficulty),
    "Revision Length": safeValue(packet.revision?.length),
    "Questions Shown": safeValue(packet.revision?.questionsShown),

    "Submitted Successfully":
      "Yes"
  };

  appendMappedRow(
    sheet,
    rowData
  );
}

function appendCurriculumRows(
  sheet,
  packet,
  receivedTimestamp
) {
  const curriculumResults =
    Array.isArray(packet.curriculumResults)
      ? packet.curriculumResults
      : [];

  const savedKeys = new Set(findSessionRows(sheet, packet.session.id, "Curriculum ID"));
  const rows = [];
  curriculumResults.forEach(result => {
    const key = String(result.id);
    if (savedKeys.has(key)) return;
    savedKeys.add(key);

    const rowData = {
      "Received Timestamp":
        receivedTimestamp,

      "Session ID":
        safeValue(packet.session?.id),

      "Activity ID":
        safeValue(packet.activity?.id),

      "Activity Title":
        safeValue(packet.activity?.title),

      "Activity Version":
        safeValue(
          packet.activity?.activityVersion
        ),

      "Mode":
        safeValue(packet.activity?.mode),

      "Student ID":
        safeValue(packet.student?.studentId),

      "Student Name":
        safeValue(packet.student?.name),

      "Class":
        safeValue(packet.student?.className),

      "Curriculum ID":
        safeValue(result.id),

      "Curriculum Name":
        safeValue(result.name),

      "Marks Awarded":
        safeValue(result.marksAwarded),

      "Marks Available":
        safeValue(result.marksAvailable),

      "Questions Correct":
        safeValue(result.correctQuestions),

      "Questions Attempted":
        safeValue(result.totalQuestions),

      "Percentage":
        safeValue(result.percentage)
    };

    rows.push(rowData);
  });
  appendMappedRows(sheet, rows);
}

function appendResponseRows(
  sheet,
  packet,
  receivedTimestamp
) {
  const responses =
    Array.isArray(packet.responses)
      ? packet.responses
      : [];

  const savedKeys = new Set(findSessionRows(sheet, packet.session.id, "Question Number"));
  const rows = [];
  responses.forEach(response => {
    const key = String(response.questionNumber);
    if (savedKeys.has(key)) return;
    savedKeys.add(key);

    const curriculumItems =
      Array.isArray(response.curriculum)
        ? response.curriculum
        : [];

    const curriculumIds =
      curriculumItems
        .map(item => item.id)
        .filter(Boolean)
        .join(", ");

    const curriculumNames =
      curriculumItems
        .map(item => item.name)
        .filter(Boolean)
        .join(", ");

    const rowData = {
      "Received Timestamp":
        receivedTimestamp,

      "Session ID":
        safeValue(packet.session?.id),

      "Activity ID":
        safeValue(packet.activity?.id),

      "Activity Title":
        safeValue(packet.activity?.title),

      "Activity Version":
        safeValue(
          packet.activity?.activityVersion
        ),

      "Mode":
        safeValue(packet.activity?.mode),

      "Student ID":
        safeValue(packet.student?.studentId),

      "Student Name":
        safeValue(packet.student?.name),

      "Class":
        safeValue(packet.student?.className),

      "Question Number":
        safeValue(response.questionNumber),

      "Question ID":
        safeValue(response.questionId),

      "Question Text":
        safeValue(response.questionText),

      "Selected Answer":
        safeValue(response.selectedAnswer),

      "Correct Answer":
        safeValue(response.correctAnswer),

      "Correct?":
        response.isCorrect
          ? "Yes"
          : "No",

      "Marks Awarded":
        safeValue(response.marksAwarded),

      "Marks Available":
        safeValue(response.marksAvailable),

      "Curriculum IDs":
        curriculumIds,

      "Question Difficulty": safeValue(response.difficulty),

      "Curriculum Names":
        curriculumNames
    };

    rows.push(rowData);
  });
  appendMappedRows(sheet, rows);
}

function appendMappedRow(sheet, rowData) {
  appendMappedRows(sheet, [rowData]);
}

function appendMappedRows(sheet, records) {
  if (records.length === 0) return;

  const width = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, width).getValues()[0];
  const rows = records.map(record => headers.map(header =>
    Object.prototype.hasOwnProperty.call(record, header)
      ? asCellValue(record[header])
      : ""
  ));

  const firstRow = sheet.getLastRow() + 1;
  const missingRows = firstRow + rows.length - 1 - sheet.getMaxRows();
  if (missingRows > 0) sheet.insertRowsAfter(sheet.getMaxRows(), missingRows);
  sheet.getRange(firstRow, 1, rows.length, width).setValues(rows);
}

function asCellValue(value) {
  return typeof value === "string" && value.startsWith("=") ? "'" + value : value;
}

function validatePacket(packet) {
  if (
    !packet ||
    typeof packet !== "object"
  ) {
    throw new Error(
      "The result packet is invalid."
    );
  }

  if (typeof packet.session?.id !== "string" || !packet.session.id.trim()) {
    throw new Error(
      "The submission has no session ID."
    );
  }

  if (!packet.activity?.id) {
    throw new Error(
      "The submission has no activity ID."
    );
  }

  if (
    packet.result?.score === undefined ||
    packet.result?.totalMarks === undefined
  ) {
    throw new Error(
      "The submission has no valid result."
    );
  }

  validateRowKeys(packet.curriculumResults, "id");
  validateRowKeys(packet.responses, "questionNumber");
}

function validateRowKeys(rows, field) {
  if (rows === undefined) return;
  if (!Array.isArray(rows)) throw new Error("Invalid submission detail rows.");

  const keys = rows.map(row => String(row?.[field] ?? ""));
  if (keys.some(key => !key.trim()) || new Set(keys).size !== keys.length) {
    throw new Error("Missing or duplicate submission detail key.");
  }
}

function safeValue(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }

  return value;
}

function createJsonResponse(data) {
  return ContentService
    .createTextOutput(
      JSON.stringify(data)
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );
}