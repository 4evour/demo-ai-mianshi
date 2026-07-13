export function extractJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  const start = cleaned.search(/[\[{]/);
  if (start < 0) throw new Error("AI response does not contain JSON");

  const open = cleaned[start];
  const close = open === "{" ? "}" : "]";
  const end = cleaned.lastIndexOf(close);
  if (end <= start) throw new Error("AI response contains incomplete JSON");

  return JSON.parse(cleaned.slice(start, end + 1));
}
