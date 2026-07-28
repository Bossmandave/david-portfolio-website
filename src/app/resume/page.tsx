import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";

import { ModuleNav } from "@/components/ModuleNav";
import { ResumeModule } from "@/modules/resume/ResumeModule";

export const metadata: Metadata = {
  title: "CV — David Uchenna Agodi",
  description:
    "Frontend engineer building production interfaces in React and Next.js, with a Mechatronics background in embedded systems and control.",
};

const PDF_PATH = "/resume.pdf";

export default function ResumePage() {
  /**
   * The download link appears only if the file is actually there.
   *
   * A "Download PDF" button that 404s is worse than no button — the reader assumes
   * the site is broken rather than that a file is missing, and it fails for the one
   * visitor who most wanted something to take away. Drop a PDF at
   * `public/resume.pdf` and the link appears on the next build; until then, printing
   * this page is the path, and it can never be out of date.
   */
  const hasPdf = existsSync(join(process.cwd(), "public", "resume.pdf"));

  return (
    <>
      <ModuleNav />
      <ResumeModule pdfHref={hasPdf ? PDF_PATH : null} />
    </>
  );
}
