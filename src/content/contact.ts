export interface Channel {
  id: string;
  label: string;
  value: string;
  href: string;
  /** Shown when the value is worth copying rather than following. */
  copyable?: boolean;
}

export const EMAIL = "agodidavid004@gmail.com";

export const CHANNELS: Channel[] = [
  {
    id: "email",
    label: "Email",
    value: EMAIL,
    href: `mailto:${EMAIL}`,
    copyable: true,
  },
  {
    id: "github",
    label: "GitHub",
    value: "github.com/Bossmandave",
    href: "https://github.com/Bossmandave",
  },
  {
    id: "phone",
    label: "Phone",
    value: "+234 907 160 4370",
    href: "tel:+2349071604370",
    copyable: true,
  },
];
