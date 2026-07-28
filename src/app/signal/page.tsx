import type { Metadata } from "next";

import { SignalModule } from "@/modules/signal/SignalModule";

export const metadata: Metadata = {
  title: "Signal — David Uchenna Agodi",
  description:
    "Open a channel. Validated on both sides, rate-limited by origin, and working with JavaScript switched off.",
};

export default function SignalPage() {
  return <SignalModule />;
}
