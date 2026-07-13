import { CandidateSession } from "@/components/candidate-session";

export default function CandidatePage({ params }: { params: { token: string } }) {
  return <CandidateSession token={params.token} />;
}
