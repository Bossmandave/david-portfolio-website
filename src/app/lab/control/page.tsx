import type { Metadata } from "next";

import { ControlSpike } from "@/modules/control/ControlSpike";

export const metadata: Metadata = {
  title: "Control rig — David Uchenna Agodi",
  description:
    "A live PID loop with tunable gains, a step-response test, and theory measured against reality.",
};

export default function ControlLab() {
  return <ControlSpike />;
}
