import { describe, expect, it } from "vitest";

import {
  hasErrors,
  readContactForm,
  validateContact,
  LIMITS,
} from "@/lib/validate-contact";

const valid = {
  name: "David Uchenna Agodi",
  email: "david@example.com",
  message: "Hello — I would like to talk about a frontend role.",
};

describe("validateContact", () => {
  it("accepts a well-formed message", () => {
    expect(hasErrors(validateContact(valid))).toBe(false);
  });

  it("rejects empty fields with a reason, not a scold", () => {
    const errors = validateContact({ name: "", email: "", message: "" });

    expect(errors.name).toBeTruthy();
    expect(errors.email).toBeTruthy();
    expect(errors.message).toBeTruthy();
    // Every message should tell the reader what to do next, so none of them are bare.
    for (const message of Object.values(errors)) {
      expect(message.length).toBeGreaterThan(12);
    }
  });

  it("catches email typos without pretending to implement RFC 5322", () => {
    expect(validateContact({ ...valid, email: "david@example" }).email).toBeTruthy();
    expect(validateContact({ ...valid, email: "david.example.com" }).email).toBeTruthy();
    expect(validateContact({ ...valid, email: "a b@example.com" }).email).toBeTruthy();

    // Legitimate addresses that a stricter regex often rejects.
    expect(validateContact({ ...valid, email: "d+tag@sub.example.co.uk" }).email)
      .toBeUndefined();
  });

  it("enforces length bounds at both ends", () => {
    expect(validateContact({ ...valid, name: "D" }).name).toBeTruthy();
    expect(
      validateContact({ ...valid, name: "D".repeat(LIMITS.name.max + 1) }).name,
    ).toBeTruthy();
    expect(validateContact({ ...valid, message: "too short" }).message).toBeTruthy();
    expect(
      validateContact({
        ...valid,
        message: "x".repeat(LIMITS.message.max + 1),
      }).message,
    ).toBeTruthy();
  });

  it("treats whitespace-only input as empty", () => {
    const errors = validateContact({
      name: "   ",
      email: "  ",
      message: "        ",
    });
    expect(Object.keys(errors)).toHaveLength(3);
  });
});

describe("readContactForm", () => {
  it("trims every field and tolerates missing ones", () => {
    const form = new FormData();
    form.set("name", "  David  ");
    form.set("email", " david@example.com ");

    expect(readContactForm(form)).toEqual({
      name: "David",
      email: "david@example.com",
      message: "",
    });
  });
});
