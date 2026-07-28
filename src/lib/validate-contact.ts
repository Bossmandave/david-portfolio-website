export interface ContactValues {
  name: string;
  email: string;
  message: string;
}

export type ContactErrors = Partial<
  Record<keyof ContactValues | "form", string>
>;

export const LIMITS = {
  name: { min: 2, max: 80 },
  message: { min: 10, max: 2000 },
  email: { max: 254 },
} as const;

/**
 * Shape check, not RFC 5322.
 *
 * A regex that fully implements the email grammar is several hundred characters long
 * and still rejects addresses that work. The only honest validation for an email is
 * sending something to it; everything before that is a typo catcher, so this is scoped
 * to catching typos and nothing more.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@.]+\.[^\s@]+$/;

/**
 * Validation lives here rather than in the server action so it can run in both places
 * from one definition — the client for instant feedback, the server because a client
 * check is a convenience and never a control.
 */
export function validateContact(values: ContactValues): ContactErrors {
  const errors: ContactErrors = {};

  const name = values.name.trim();
  if (name.length === 0) {
    errors.name = "Add a name so I know who I'm replying to.";
  } else if (name.length < LIMITS.name.min) {
    errors.name = "That looks too short to be a name.";
  } else if (name.length > LIMITS.name.max) {
    errors.name = `Keep it under ${LIMITS.name.max} characters.`;
  }

  const email = values.email.trim();
  if (email.length === 0) {
    errors.email = "Add an email address — it's the only way to reply.";
  } else if (email.length > LIMITS.email.max) {
    errors.email = "That address is longer than any real one.";
  } else if (!EMAIL_SHAPE.test(email)) {
    errors.email = "That doesn't look like an email address. Check for a typo.";
  }

  const message = values.message.trim();
  if (message.length === 0) {
    errors.message = "The message is empty.";
  } else if (message.length < LIMITS.message.min) {
    errors.message = `A few more words — at least ${LIMITS.message.min} characters.`;
  } else if (message.length > LIMITS.message.max) {
    errors.message = `That's ${message.length} characters; the limit is ${LIMITS.message.max}. Email me directly for anything longer.`;
  }

  return errors;
}

export function hasErrors(errors: ContactErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** Reads and trims the fields, so every consumer sees the same normalised shape. */
export function readContactForm(formData: FormData): ContactValues {
  const read = (key: string) => String(formData.get(key) ?? "").trim();
  return {
    name: read("name"),
    email: read("email"),
    message: read("message"),
  };
}
