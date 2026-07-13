import assert from "node:assert/strict";
import test from "node:test";

import { extractLocalIdentity, extractResumeHonors, prepareResumeText } from "../lib/resume";

const resumeText = `
张三
zhangsan@example.com
22 岁 应届生 https://example.com
教育背景
示例大学 计算机科学与技术(本科) 2023.09 - 2027.07
专业技能
熟悉 Go 与 TypeScript
项目经历
知识库问答平台
荣誉证书
2025｜程序设计竞赛铜牌
2025｜计算机设计大赛国家三等奖
自我评价
持续学习
`;

test("extracts an unlabeled Chinese name from the resume header", () => {
  const identity = extractLocalIdentity(resumeText);

  assert.equal(identity.name, "张三");
  assert.equal(identity.school, "示例大学");
  assert.equal(identity.major, "计算机科学与技术");
  assert.deepEqual(identity.education, [{
    school: "示例大学",
    major: "计算机科学与技术",
    degree: "本科",
    period: "2023.09 - 2027.07",
  }]);
});

test("extracts every item from a structured honors section", () => {
  assert.deepEqual(extractResumeHonors(resumeText), [
    "2025｜程序设计竞赛铜牌",
    "2025｜计算机设计大赛国家三等奖",
  ]);
});

test("redacts unlabeled header identity and school before model calls", () => {
  const prepared = prepareResumeText(resumeText);

  assert.doesNotMatch(prepared.redactedText, /张三|示例大学|zhangsan@example\.com/);
  assert.match(prepared.redactedText, /REDACTED_NAME|REDACTED_SCHOOL/);
});
