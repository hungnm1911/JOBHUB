import { describe, expect, it, vi } from "vitest";

const sendMailThroughTransport = vi.hoisted(() => vi.fn());

vi.mock("../../src/config/index.js", () => ({
  default: {
    smtp: {
      user: "technical-login@smtp-brevo.com",
      fromAddress: "verified-sender@example.com",
      fromName: "JobHub",
    },
  },
}));

vi.mock("../../src/config/mailer.js", () => ({
  default: { sendMail: sendMailThroughTransport },
}));

import sendMail from "../../src/services/mail.service.js";

describe("SMTP sender identity", () => {
  it("sends from the configured sender rather than the SMTP login", async () => {
    await sendMail({ to: "recipient@example.com", subject: "Test", text: "Hello" });

    expect(sendMailThroughTransport).toHaveBeenCalledWith({
      from: '"JobHub" <verified-sender@example.com>',
      to: "recipient@example.com",
      subject: "Test",
      text: "Hello",
      html: undefined,
    });
  });
});
