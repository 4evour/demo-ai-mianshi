import assert from "node:assert/strict";
import test from "node:test";

import { resumeAiSchema } from "../lib/schemas";

test("accepts projects when the model omits optional role and description", () => {
  const parsed = resumeAiSchema.parse({
    summary: "候选人具备项目经验",
    skills: ["Python"],
    projects: [
      { name: "知识库问答", technologies: ["RAG"], claims: ["完成检索模块"] },
      { name: "智能助手", technologies: [], claims: [] },
    ],
    honors: ["程序设计竞赛铜牌", "计算机设计大赛国家三等奖"],
    artifactLinks: [],
  });

  assert.equal(parsed.projects[0]?.role, "");
  assert.equal(parsed.projects[0]?.description, "");
  assert.equal(parsed.projects[1]?.role, "");
  assert.equal(parsed.projects[1]?.description, "");
  assert.deepEqual(parsed.honors, ["程序设计竞赛铜牌", "计算机设计大赛国家三等奖"]);
});
