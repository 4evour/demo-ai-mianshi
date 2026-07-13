import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { POST } from "../app/api/sessions/route";

const candidateId = "00000000-0000-4000-8000-000000000001";

test("publishes a session with one non-empty question", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "screening-question-publishing-"));
  const dataFile = path.join(directory, "store.json");
  const previousDataFile = process.env.SCREENING_DATA_FILE;
  process.env.SCREENING_DATA_FILE = dataFile;
  await writeFile(dataFile, JSON.stringify({
    jobs: [],
    candidates: [{
      id: candidateId,
      jobId: "job-1",
      name: "张三",
      email: "",
      status: "READY",
      createdAt: "now",
      resume: {
        name: "张三", email: "", phone: "", school: "", major: "", summary: "", skills: [],
        projects: [], artifactLinks: [], sourceText: "", redactedText: "",
      },
    }],
    sessions: [], reports: [], resumeImports: [],
  }), "utf8");

  try {
    const response = await POST(new Request("http://localhost/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        candidateId,
        questions: [{
          id: "00000000-0000-4000-8000-000000000002",
          text: "请介绍项目。",
          purpose: "",
          dimension: "",
          required: true,
        }],
        maxFollowUps: 3,
      }),
    }));

    assert.equal(response.status, 201);
    const saved = JSON.parse(await readFile(dataFile, "utf8"));
    assert.equal(saved.sessions[0]?.questions.length, 1);
  } finally {
    if (previousDataFile === undefined) delete process.env.SCREENING_DATA_FILE;
    else process.env.SCREENING_DATA_FILE = previousDataFile;
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects an empty question list", async () => {
  const response = await POST(new Request("http://localhost/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidateId, questions: [], maxFollowUps: 3 }),
  }));
  assert.equal(response.status, 400);
});

test("rejects a question whose text is blank", async () => {
  const response = await POST(new Request("http://localhost/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      candidateId,
      questions: [{
        id: "00000000-0000-4000-8000-000000000002",
        text: "   ",
        purpose: "",
        dimension: "",
        required: false,
      }],
      maxFollowUps: 3,
    }),
  }));
  assert.equal(response.status, 400);
});
