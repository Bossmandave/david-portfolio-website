import type { Metadata } from "next";

import { PathModule } from "@/modules/path/PathModule";

export const metadata: Metadata = {
  title: "Path — David Uchenna Agodi",
  description:
    "Mechatronics to systems thinking to frontend to AI interfaces, drawn as a signal chain rather than a timeline.",
};

export default function PathPage() {
  return <PathModule />;
}
