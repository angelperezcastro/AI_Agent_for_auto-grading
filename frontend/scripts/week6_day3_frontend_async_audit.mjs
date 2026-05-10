import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, "src");

const FILE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx"]);

const UI_PATH_MARKERS = [
  "/components/",
  "/pages/",
  "/context/",
  "/hooks/",
];

const NON_UI_PATH_MARKERS = [
  "/services/",
];

const REQUIRED_EMAIL_MESSAGES = [
  {
    name: "OAuth popup closed/failure message",
    patterns: [
      /Connect Gmail/i,
      /popup/i,
      /closed|cancelled|blocked|failed/i,
      /Settings/i,
    ],
    hint:
      "When Connect Gmail OAuth fails or the popup is closed, show a helpful message.",
  },
  {
    name: "Send Test Email failure reason",
    patterns: [
      /Send Test Email/i,
      /failed|error/i,
      /reason|backend|detail|message/i,
    ],
    hint:
      "When Send Test Email fails, show the backend error reason to the professor.",
  },
  {
    name: "Submission saved but email failed message",
    patterns: [
      /Submission saved/i,
      /Email delivery failed/i,
      /check Settings/i,
    ],
    hint:
      'If submission is saved but email fails, show: "Submission saved. Email delivery failed — check Settings."',
  },
];

function walk(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (
        entry.name === "node_modules" ||
        entry.name === "dist" ||
        entry.name === "build"
      ) {
        continue;
      }

      files.push(...walk(fullPath));
    } else {
      const ext = path.extname(entry.name);

      if (FILE_EXTENSIONS.has(ext)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replaceAll("\\", "/");
}

function normalized(filePath) {
  return `/${relative(filePath)}`;
}

function isUiFile(filePath) {
  const rel = normalized(filePath);

  if (NON_UI_PATH_MARKERS.some((marker) => rel.includes(marker))) {
    return false;
  }

  return UI_PATH_MARKERS.some((marker) => rel.includes(marker));
}

function hasAsyncAction(content) {
  return (
    /\bfetch\s*\(/.test(content) ||
    /\baxios\b/.test(content) ||
    /\bapi\./.test(content) ||
    /\.then\s*\(/.test(content) ||
    /\bawait\b/.test(content)
  );
}

function hasLoadingState(content) {
  return (
    /loading/i.test(content) ||
    /isLoading/.test(content) ||
    /setLoading/.test(content) ||
    /pending/i.test(content) ||
    /disabled\s*=/.test(content) ||
    /spinner/i.test(content) ||
    /Submitting/i.test(content) ||
    /Saving/i.test(content) ||
    /Sending/i.test(content)
  );
}

function hasErrorState(content) {
  return (
    /error/i.test(content) ||
    /setError/.test(content) ||
    /catch\s*\(/.test(content) ||
    /try\s*{/.test(content) ||
    /toast/i.test(content) ||
    /alert/i.test(content)
  );
}

function hasFinallyOrCleanup(content) {
  return (
    /finally\s*\(/.test(content) ||
    /finally\s*{/.test(content) ||
    /setLoading\s*\(\s*false\s*\)/.test(content) ||
    /setIsLoading\s*\(\s*false\s*\)/.test(content) ||
    /setSubmitting\s*\(\s*false\s*\)/.test(content) ||
    /setSaving\s*\(\s*false\s*\)/.test(content) ||
    /setSending\s*\(\s*false\s*\)/.test(content)
  );
}

function checkAsyncFiles(files) {
  const issues = [];
  const checked = [];
  const skippedNonUi = [];

  for (const file of files) {
    const content = read(file);

    if (!hasAsyncAction(content)) {
      continue;
    }

    if (!isUiFile(file)) {
      skippedNonUi.push(relative(file));
      continue;
    }

    const fileIssues = [];

    if (!hasLoadingState(content)) {
      fileIssues.push("Missing obvious loading/pending/disabled state.");
    }

    if (!hasErrorState(content)) {
      fileIssues.push("Missing obvious error/catch/toast/alert state.");
    }

    if (!hasFinallyOrCleanup(content)) {
      fileIssues.push("Missing obvious loading cleanup/finally block.");
    }

    checked.push(relative(file));

    if (fileIssues.length > 0) {
      issues.push({
        file: relative(file),
        issues: fileIssues,
      });
    }
  }

  return { checked, skippedNonUi, issues };
}

function checkRequiredEmailMessages(files) {
  const allContent = files
    .map((file) => {
      const content = read(file);
      return `\n/* FILE: ${relative(file)} */\n${content}`;
    })
    .join("\n");

  const results = [];

  for (const requirement of REQUIRED_EMAIL_MESSAGES) {
    const passed = requirement.patterns.every((pattern) =>
      pattern.test(allContent),
    );

    results.push({
      name: requirement.name,
      passed,
      hint: requirement.hint,
    });
  }

  return results;
}

function main() {
  console.log("\nWEEK 6 DAY 3 — FRONTEND ASYNC/ERROR STATE AUDIT");
  console.log("=".repeat(100));

  if (!fs.existsSync(SRC_DIR)) {
    console.error(`src directory not found: ${SRC_DIR}`);
    process.exit(1);
  }

  const files = walk(SRC_DIR);
  const { checked, skippedNonUi, issues } = checkAsyncFiles(files);
  const emailResults = checkRequiredEmailMessages(files);

  console.log(`Files scanned: ${files.length}`);
  console.log(`UI async files checked: ${checked.length}`);
  console.log(`Non-UI async files skipped: ${skippedNonUi.length}`);
  console.log("=".repeat(100));

  if (checked.length > 0) {
    console.log("\nUI async files:");
    for (const file of checked) {
      console.log(`- ${file}`);
    }
  }

  if (skippedNonUi.length > 0) {
    console.log("\nSkipped non-UI async files:");
    for (const file of skippedNonUi) {
      console.log(`- ${file}`);
    }
  }

  console.log("\nAsync state issues:");
  if (issues.length === 0) {
    console.log("[PASS] All checked UI async files have visible loading/error indicators.");
  } else {
    for (const item of issues) {
      console.log(`[FAIL] ${item.file}`);
      for (const issue of item.issues) {
        console.log(`       - ${issue}`);
      }
    }
  }

  console.log("\nEmail-specific UX messages:");
  let emailFailures = 0;

  for (const result of emailResults) {
    if (result.passed) {
      console.log(`[PASS] ${result.name}`);
    } else {
      emailFailures += 1;
      console.log(`[FAIL] ${result.name}`);
      console.log(`       ${result.hint}`);
    }
  }

  console.log("=".repeat(100));

  if (issues.length > 0 || emailFailures > 0) {
    console.log("\nFRONTEND AUDIT FAILED");
    console.log("Fix the reported files/messages, then run this script again.");
    process.exit(1);
  }

  console.log("\nFRONTEND AUDIT PASSED");
  console.log(
    "All checked UI async actions expose loading/error states and required email UX copy is present.\n",
  );
}

main();