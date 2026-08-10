import { describe, expect, it } from "vitest";

import config from "../../src/config/index.js";
import buildAuthActionUrl from "../../src/utils/auth-action-url.js";
import buildCompanyApprovalConfirmationEmail from "../../src/utils/company-approval-confirmation-email.js";
import buildRecruiterActivationEmail from "../../src/utils/recruiter-activation-email.js";

describe("auth email action URLs", () => {
  it("builds confirmation and activation links under /api/auth for browser GET", () => {
    const rawToken = "abc123";

    expect(buildAuthActionUrl("confirm-company-approval", rawToken)).toBe(
      `${config.appBaseUrl}/api/auth/confirm-company-approval?token=abc123`,
    );
    expect(buildAuthActionUrl("/activate-recruiter", rawToken)).toBe(
      `${config.appBaseUrl}/api/auth/activate-recruiter?token=abc123`,
    );

    const confirmation = buildCompanyApprovalConfirmationEmail({
      fullName: "Chris",
      companyName: "Acme",
      rawToken,
    });
    expect(confirmation.html).toContain(
      `${config.appBaseUrl}/api/auth/confirm-company-approval?token=abc123`,
    );

    const activation = buildRecruiterActivationEmail({
      fullName: "Riley",
      companyName: "Acme",
      rawToken,
    });
    expect(activation.html).toContain(
      `${config.appBaseUrl}/api/auth/activate-recruiter?token=abc123`,
    );
  });
});
