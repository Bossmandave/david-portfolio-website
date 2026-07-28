import type { Metadata } from "next";

import { WorkIndex } from "@/modules/work/WorkIndex";

export const metadata: Metadata = {
  title: "Work — David Uchenna Agodi",
  description:
    "Case studies written as systems: the problem, the constraints that were real, the decision that could have gone the other way, and what it cost.",
};

export default function WorkPage() {
  return <WorkIndex />;
}
