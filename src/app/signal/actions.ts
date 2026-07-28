"use server";

import { headers } from "next/headers";

import type { ContactState } from "@/lib/contact-state";
import { rateLimit } from "@/lib/rate-limit";
import {
  hasErrors,
  readContactForm,
  validateContact,
  type ContactValues,
} from "@/lib/validate-contact";

async function clientKey(): Promise<string> {
  const store = await headers();
  // The first entry is the client; everything after is proxies that appended themselves.
  const forwarded = store.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || store.get("x-real-ip") || "unknown";
}

/**
 * Delivery.
 *
 * There is deliberately no fallback that pretends to succeed. A contact form that
 * silently discards messages is worse than no contact form, because the sender walks
 * away believing they have reached someone. With no transport configured, production
 * says so and points at the mailbox instead.
 */
async function deliver(values: ContactValues): Promise<boolean> {
  const endpoint = process.env.CONTACT_WEBHOOK_URL;

  if (!endpoint) {
    if (process.env.NODE_ENV === "development") {
      console.info("[signal] no CONTACT_WEBHOOK_URL set; message not sent:", values);
      return true;
    }
    return false;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // Form relays answer HTML redirects by default. Asking for JSON keeps the
      // reply a status we can read, rather than a 302 to a thank-you page that
      // `fetch` follows and reports as success whatever actually happened.
      accept: "application/json",
    },
    body: JSON.stringify({ ...values, receivedAt: new Date().toISOString() }),
  });

  return response.ok;
}

export async function submitContact(
  _previous: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const values = readContactForm(formData);

  // Honeypot. A field hidden from people and irresistible to naive bots; when it is
  // filled, report success and drop the message rather than teaching the bot what
  // tripped it.
  if (String(formData.get("company") ?? "").length > 0) {
    return { status: "sent" };
  }

  const errors = validateContact(values);
  if (hasErrors(errors)) {
    return { status: "error", errors, values };
  }

  const limit = rateLimit(await clientKey());
  if (!limit.ok) {
    const minutes = Math.ceil(limit.retryAfter / 60);
    return {
      status: "error",
      values,
      errors: {
        form: `That's a few messages in quick succession. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}, or email me directly.`,
      },
    };
  }

  try {
    const delivered = await deliver(values);
    if (!delivered) {
      return {
        status: "error",
        values,
        errors: {
          form: "The channel isn't accepting messages right now. Email me directly — the address is below and it always works.",
        },
      };
    }
  } catch {
    return {
      status: "error",
      values,
      errors: {
        form: "The message didn't get through. Email me directly — the address is below.",
      },
    };
  }

  return { status: "sent" };
}
