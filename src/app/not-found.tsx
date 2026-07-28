import type { Metadata } from "next";

import { ModuleNav } from "@/components/ModuleNav";
import { NotFoundModule } from "@/modules/not-found/NotFoundModule";

export const metadata: Metadata = {
  title: "Setpoint undefined — David Uchenna Agodi",
  description: "No route is mapped to that address.",
  // A 404 has nothing worth indexing and should never compete with a real page.
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <>
      <ModuleNav />
      <NotFoundModule />
    </>
  );
}
