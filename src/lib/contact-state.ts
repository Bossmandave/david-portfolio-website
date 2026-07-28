import type { ContactErrors, ContactValues } from "@/lib/validate-contact";

/**
 * The form's state machine, kept out of the `"use server"` module.
 *
 * A file marked `"use server"` may export nothing but async functions — every export
 * becomes a callable server endpoint, so a plain object has no meaning there and Next
 * rejects the module outright. Types survive because they are erased before that check;
 * a constant does not. Hence this file: the action exports only the action, and both it
 * and the form read their shared shapes from here.
 */
export type ContactState =
  | { status: "idle" }
  | { status: "error"; errors: ContactErrors; values: ContactValues }
  | { status: "sent" };

export const INITIAL_CONTACT_STATE: ContactState = { status: "idle" };
