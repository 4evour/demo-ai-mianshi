const patterns: Array<[RegExp, string]> = [
  [/([A-Z0-9._%+-]+)@([A-Z0-9.-]+\.[A-Z]{2,})/gi, "[REDACTED_EMAIL]"],
  [/(?<!\d)(?:\+?86[-\s]?)?1[3-9]\d{9}(?!\d)/g, "[REDACTED_PHONE]"],
  [/(?:手机号|手机|电话|联系电话)\s*[:：]?\s*[\d+\-\s]{7,}/gi, "手机号：[REDACTED_PHONE]"],
  [/(?:姓名|真实姓名)\s*[:：]\s*[^\n\r]{1,20}/gi, "姓名：[REDACTED_NAME]"],
  [/(?:学校|院校|毕业于|就读于)\s*[:：]?\s*[^\n\r，,。；;]{2,40}/gi, "学校：[REDACTED_SCHOOL]"],
];

export function redactForModel(text: string): string {
  return patterns.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), text);
}

export function containsLikelyPii(text: string): boolean {
  return /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|(?<!\d)(?:\+?86[-\s]?)?1[3-9]\d{9}(?!\d)/.test(text);
}
