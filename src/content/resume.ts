export interface SkillGroup {
  label: string;
  items: string[];
}

export interface Position {
  role: string;
  org: string;
  note?: string;
}

export interface ResumeProject {
  name: string;
  kind: string;
  points: string[];
  href?: string;
}

/**
 * The CV as data.
 *
 * One source, rendered to the screen and to paper by the same component — so the
 * printed copy can never drift out of step with the web one, which is the failure mode
 * of keeping a separate PDF up to date by hand.
 */
export const RESUME = {
  name: "David Uchenna Agodi",
  title: "Frontend Engineer · Mechatronics Engineer · AI Interfaces",

  /**
   * Rewritten from the original, which opened "A highly motivated and innovative
   * Engineer with a comprehensive foundation in..." — phrasing that costs the reader
   * two lines before saying anything. This says the same thing in the register the
   * rest of the site uses. The original is recoverable from the PDF if preferred.
   */
  summary:
    "Frontend engineer building production interfaces in React and Next.js, with a Mechatronics background in embedded systems and control. I work at the seam between physical systems and the web — real-time device control, streaming AI interfaces, and the state management that makes both behave under load.",

  contact: {
    email: "agodidavid004@gmail.com",
    phone: "+234 907 160 4370",
    github: "github.com/Bossmandave",
  },

  skills: [
    {
      label: "Frontend",
      items: [
        "React",
        "Next.js",
        "TypeScript",
        "JavaScript",
        "HTML5",
        "Tailwind CSS",
        "Framer Motion",
        "Figma",
      ],
    },
    {
      label: "State & data",
      items: [
        "Redux Toolkit",
        "Context API",
        "React Query",
        "React Hook Form",
        "RESTful APIs",
      ],
    },
    {
      label: "Backend & core",
      items: ["Python", "Flask", "Firebase", "Authentication", "Node.js"],
    },
    {
      label: "Embedded & IoT",
      items: [
        "Raspberry Pi",
        "Arduino",
        "Control systems",
        "Motor control",
        "Sensor integration",
      ],
    },
    {
      label: "Tools",
      items: ["Git & GitHub", "Vercel", "VS Code", "3D design & printing"],
    },
  ] satisfies SkillGroup[],

  experience: [
    { role: "Frontend Developer", org: "BrandDrive", note: "Current" },
    { role: "Frontend Developer Intern", org: "Juray Smart Solutions Ltd" },
    { role: "Web Development Intern", org: "Zidio Web Development" },
    { role: "Robotics Intern", org: "Baun Robotics Educational Solutions" },
    {
      role: "STEM collaboration",
      org: "3D Robotronics",
      note: "Web technologies against cloud platforms",
    },
  ] satisfies Position[],

  projects: [
    {
      name: "Face-Recognition Door Access",
      kind: "Full-stack IoT · final-year project",
      points: [
        "Real-time facial recognition on a Raspberry Pi 4, matching on-device at a 0.40 distance threshold — no cloud inference and no face data leaving the box.",
        "Flask control API driving a solenoid lock through a relay, with a background auto-lock deadline so a dropped request can never leave the door open.",
        "React dashboard with a live MJPEG feed, remote unlock, face enrollment and an access log. 1.3 s match on-device; 800 ms end-to-end remote unlock.",
      ],
    },
    {
      name: "LysterPro",
      kind: "Job platform",
      href: "https://lysterpro.vercel.app/",
      points: [
        "Job board where employers post and applicants track, built in React and Tailwind.",
        "Authentication, posting forms and application tracking, with React Query handling fetching and cache synchronisation across user and listing data.",
      ],
    },
    {
      name: "CVerify",
      kind: "Certificate verification",
      href: "https://cverify.vercel.app/",
      points: [
        "Web application for authenticating issued documents, with an administrative dashboard for managing verification records.",
      ],
    },
    {
      name: "Adaptive Control for Irrigation",
      kind: "Mechatronics & data",
      points: [
        "Adaptive control algorithms optimising water distribution from live environmental inputs, modulating output rather than switching on fixed thresholds.",
      ],
    },
  ] satisfies ResumeProject[],

  education: {
    institution: "Afe Babalola University, Ado-Ekiti, Nigeria",
    award: "B.Eng, Mechatronics Engineering",
    span: "2020 — 2025",
    coursework: ["Embedded Systems", "Control Systems", "Heat Transfer"],
  },
} as const;
