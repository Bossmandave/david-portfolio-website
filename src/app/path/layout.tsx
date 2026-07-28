import type { ReactNode } from "react";

import { ModuleNav } from "@/components/ModuleNav";

// Each module carries its own chrome rather than sharing one route-group layout.
// The duplication is three lines; the alternative is every module fighting a shared
// shell the first time one of them needs different framing.
export default function PathLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ModuleNav />
      {children}
    </>
  );
}
