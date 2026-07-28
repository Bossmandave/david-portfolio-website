export interface PathRole {
  title: string;
  org: string;
  note?: string;
}

export interface PathStage {
  id: string;
  /** The block's function in the chain — the diagram's own vocabulary. */
  block: string;
  title: string;
  span: string;
  /** One line, in the register of a lesson rather than a job description. */
  lesson: string;
  body: string;
  skills: string[];
  roles: PathRole[];
}

/**
 * The career drawn as a signal chain.
 *
 * This is deliberately not a force-directed skill cloud. A block diagram is what an
 * engineer actually reaches for to describe a system, it stays legible at a glance, and
 * it lets the about section, the skills section and the timeline be the same artifact
 * instead of three sections making the same point three times.
 *
 * The stages are ordered by when they entered the chain, not by importance — the plant
 * came first because it had to.
 */
export const PATH_STAGES: PathStage[] = [
  {
    id: "plant",
    block: "Plant",
    title: "Mechatronics",
    span: "2020 — 2025",
    lesson: "A system is judged by its response to the input nobody planned for.",
    body: "Five years of B.Eng Mechatronics at Afe Babalola University: embedded systems, control systems, heat transfer. Physical systems are unforgiving in a way software is not — a bug in a control loop is a motor that overshoots into a hard stop, and you cannot patch your way out of a thermal limit. That constraint is the whole education.",
    skills: [
      "Control Systems",
      "Embedded Systems",
      "Raspberry Pi",
      "Arduino",
      "Sensor Integration",
      "Motor Control",
      "3D Design & Printing",
    ],
    roles: [
      {
        title: "B.Eng Mechatronics Engineering",
        org: "Afe Babalola University, Ado-Ekiti",
        note: "2020 — 2025",
      },
      { title: "Robotics Intern", org: "Baun Robotics Educational Solutions" },
      {
        title: "STEM collaboration",
        org: "3D Robotronics",
        note: "Web technologies against cloud platforms",
      },
    ],
  },
  {
    id: "controller",
    block: "Controller",
    title: "Systems thinking",
    span: "The bridge",
    lesson: "An interface is a plant with a human in the loop.",
    body: "The habit that carries across: model the thing, find where the feedback closes, and ask what happens at the limits. Adaptive irrigation control taught the same lesson as a React state machine — the interesting behaviour is never in the steady state, it is in what the system does while it is still settling, and in what it does when an input arrives that the model did not anticipate.",
    skills: [
      "Python",
      "Flask",
      "RESTful API design",
      "Adaptive control",
      "Real-time data",
    ],
    roles: [
      {
        title: "Adaptive Control for Irrigation",
        org: "Research project",
        note: "Control logic modulating output from live environmental inputs",
      },
    ],
  },
  {
    id: "interface",
    block: "Interface",
    title: "Frontend",
    span: "2023 — now",
    lesson: "The output stage is where the whole system is judged.",
    body: "Everything upstream — the architecture, the data model, the cleverness — reaches a person only through the interface, and they will judge all of it by how the button felt. React and Next in production: state that survives contact with real users, data fetching that does not thrash, forms that behave when the network does not.",
    skills: [
      "React",
      "Next.js",
      "TypeScript",
      "Tailwind CSS",
      "Framer Motion",
      "React Query",
      "Redux Toolkit",
      "Context API",
      "React Hook Form",
      "Figma",
      "Vercel",
    ],
    roles: [
      { title: "Frontend Developer Intern", org: "Juray Smart Solutions Ltd" },
      { title: "Web Development Intern", org: "Zidio Web Development" },
    ],
  },
  {
    id: "output",
    block: "Output",
    title: "AI interfaces",
    span: "Now",
    lesson: "Pending states measured in seconds, not milliseconds.",
    body: "Shipping the front end of an AI feature is not ordinary UI work. A response arrives token by token instead of all at once, so the render path has to stay smooth under a stream. A wait lasts twenty seconds instead of two hundred milliseconds, so the loading state has to carry real information. And a request can fail halfway through succeeding, which almost nothing else in frontend does.",
    skills: [
      "Streaming interfaces",
      "Firebase",
      "Authentication",
      "Node.js",
      "Git & GitHub",
    ],
    roles: [{ title: "Frontend Developer", org: "BrandDrive", note: "Current" }],
  },
];
