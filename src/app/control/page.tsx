import type { Metadata } from "next";

import { ControlModule } from "@/modules/control/ControlModule";

export const metadata: Metadata = {
  title: "Control — David Uchenna Agodi",
  description:
    "A real PID loop holding a piece of interface. Take the damping out and watch it hunt for the target and keep missing.",
};

export default function ControlPage() {
  return <ControlModule />;
}
