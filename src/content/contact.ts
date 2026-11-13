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
    value: "+370 662 13 951",
    href: "tel:+37066213951",
    copyable: true,
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    value: "linkedin.com/in/david-uchenna-agodi-369a88283",
    href: "https://linkedin.com/in/david-uchenna-agodi-369a88283",
  },
];
