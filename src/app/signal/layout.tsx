import type { ReactNode } from "react";

import { ModuleNav } from "@/components/ModuleNav";

export default function SignalLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ModuleNav />
      {children}
    </>
  );
}
