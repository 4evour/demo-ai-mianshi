export function toggleComparisonCandidate(selected: string[], candidateId: string): string[] {
  if (selected.includes(candidateId)) return selected.filter((id) => id !== candidateId);
  if (selected.length >= 2) return selected;
  return [...selected, candidateId];
}
