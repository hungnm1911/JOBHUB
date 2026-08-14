import APPLICATION_STATUS from "../constants/application-status.js";
import COMPANY_MEMBER_STATUS from "../constants/company-member-status.js";
import USER_STATUS from "../constants/user-status.js";

const TERMINAL_APPLICATION_STATUSES = Object.freeze([
  APPLICATION_STATUS.HIRED,
  APPLICATION_STATUS.REJECTED,
  APPLICATION_STATUS.WITHDRAWN,
]);

const isTerminalApplicationStatus = (status) => {
  return TERMINAL_APPLICATION_STATUSES.includes(status);
};

const isAccountLifecycleRestricted = ({ userStatus, membershipStatus } = {}) => {
  return (
    userStatus === USER_STATUS.LOCKED ||
    userStatus === USER_STATUS.TERMINATED ||
    membershipStatus === COMPANY_MEMBER_STATUS.LOCKED ||
    membershipStatus === COMPANY_MEMBER_STATUS.TERMINATED
  );
};

const isActiveAccountPair = ({ userStatus, membershipStatus } = {}) => {
  return (
    userStatus === USER_STATUS.ACTIVE &&
    membershipStatus === COMPANY_MEMBER_STATUS.ACTIVE
  );
};

const isPersistedAssigneeActor = ({ actor, currentAssignee } = {}) => {
  return (
    actor?.kind === "RECRUITER" &&
    currentAssignee != null &&
    actor.companyMemberId != null &&
    String(actor.companyMemberId) === String(currentAssignee.companyMemberId) &&
    isActiveAccountPair({
      userStatus: actor.userStatus,
      membershipStatus: actor.membershipStatus,
    })
  );
};

/**
 * Pure Application Conversation Chat authority evaluation (V11 F05 foundation +
 * Slice 05 historical read modes).
 *
 * Encodes eligibility-loss window (BR-26 / BR-55), post-Automatic-Unassign
 * PAUSED_UNASSIGNED behavior (BR-22 / BR-27), Company-lock freeze historical
 * read (BR-31–BR-33 / BR-54), terminal historical read (BR-34–BR-38 / BR-54),
 * and BR-54 denial when User or CompanyMember is LOCKED/TERMINATED.
 *
 * Authorization is derived from current Application / lifecycle facts only —
 * never from Message history, participant lists, or duplicated Conversation
 * state. NORMAL Message Send reuses this evaluator inside TX-06–TX-08 commit
 * coordination in application.service (no parallel Chat-authority source).
 *
 * @param {object} input
 * @param {boolean} input.conversationExists
 * @param {string} input.applicationStatus
 * @param {boolean} input.isUnassigned
 * @param {boolean} input.companyIsOperational
 * @param {null | {
 *   companyMemberId: string,
 *   userId: string,
 *   membershipStatus: string,
 *   userStatus: string,
 *   isContinuouslyEligible: boolean,
 * }} input.currentAssignee
 * @param {{
 *   kind: "CANDIDATE" | "RECRUITER",
 *   userId: string,
 *   companyMemberId?: string | null,
 *   membershipStatus?: string | null,
 *   userStatus?: string | null,
 * }} input.actor
 * @returns {{ canRead: boolean, canSendNormal: boolean, mode: string }}
 */
const evaluateApplicationConversationChatAuthority = ({
  conversationExists = false,
  applicationStatus,
  isUnassigned = false,
  companyIsOperational = true,
  currentAssignee = null,
  actor,
} = {}) => {
  if (!conversationExists || !actor?.kind || !actor?.userId) {
    return { canRead: false, canSendNormal: false, mode: "NOT_CREATED" };
  }

  const applicationIsTerminal = isTerminalApplicationStatus(applicationStatus);

  // BR-54: LOCKED / TERMINATED User or CompanyMember never retain Chat access
  // via persisted or historical association.
  if (
    actor.kind === "RECRUITER" &&
    isAccountLifecycleRestricted({
      userStatus: actor.userStatus,
      membershipStatus: actor.membershipStatus,
    })
  ) {
    return {
      canRead: false,
      canSendNormal: false,
      mode: applicationIsTerminal
        ? "READ_ONLY"
        : isUnassigned
          ? "PAUSED_UNASSIGNED"
          : companyIsOperational
            ? "ELIGIBILITY_LOSS_WINDOW"
            : "FROZEN_COMPANY",
    };
  }

  if (applicationIsTerminal) {
    // F08 / BR-34–BR-38 / BR-54: terminal history. Candidate always reads when
    // Conversation exists. Final Assignee reads only with ACTIVE User +
    // ACTIVE CompanyMember; team membership and Company operational are not
    // required. WITHDRAWN + UNASSIGNED grants no Recruiter historical authority.
    if (actor.kind === "CANDIDATE") {
      return { canRead: true, canSendNormal: false, mode: "READ_ONLY" };
    }

    if (!isUnassigned && isPersistedAssigneeActor({ actor, currentAssignee })) {
      return { canRead: true, canSendNormal: false, mode: "READ_ONLY" };
    }

    return { canRead: false, canSendNormal: false, mode: "READ_ONLY" };
  }

  // BR-22 / BR-27: UNASSIGNED pause outranks Company-lock mode labeling when
  // Assignment State is already NONE (FROZEN_COMPANY requires ASSIGNED).
  if (isUnassigned) {
    if (actor.kind === "CANDIDATE") {
      return {
        canRead: true,
        canSendNormal: false,
        mode: "PAUSED_UNASSIGNED",
      };
    }

    return {
      canRead: false,
      canSendNormal: false,
      mode: "PAUSED_UNASSIGNED",
    };
  }

  if (!companyIsOperational) {
    // F07 / BR-31–BR-33 / BR-54: Company-lock freeze. Candidate and persisted
    // Assignee with ACTIVE accounts may read; no actor may send. Team
    // membership and Company operational are not required for this historical
    // read. Company lock does not invent Chat authority for other actors.
    if (actor.kind === "CANDIDATE") {
      return {
        canRead: true,
        canSendNormal: false,
        mode: "FROZEN_COMPANY",
      };
    }

    if (isPersistedAssigneeActor({ actor, currentAssignee })) {
      return {
        canRead: true,
        canSendNormal: false,
        mode: "FROZEN_COMPANY",
      };
    }

    return {
      canRead: false,
      canSendNormal: false,
      mode: "FROZEN_COMPANY",
    };
  }

  // Eligibility-loss window: Assignee still persisted, but continuous
  // eligibility is already lost. Authority must not wait for A → NONE (BR-26 /
  // BR-55). Candidate may read history only; outgoing Recruiter may not read
  // or send; no actor may send NORMAL Message.
  if (currentAssignee && currentAssignee.isContinuouslyEligible !== true) {
    if (actor.kind === "CANDIDATE") {
      return {
        canRead: true,
        canSendNormal: false,
        mode: "ELIGIBILITY_LOSS_WINDOW",
      };
    }

    return {
      canRead: false,
      canSendNormal: false,
      mode: "ELIGIBILITY_LOSS_WINDOW",
    };
  }

  // ACTIVE Conversation: Candidate and current continuously eligible Assignee
  // may read and send. Send commit-time races are coordinated in
  // application.service (TX-06–TX-08). Job CLOSED / EXPIRED is intentionally
  // not an input (F09 / BR-39 / BR-40).
  if (actor.kind === "CANDIDATE") {
    return { canRead: true, canSendNormal: true, mode: "ACTIVE" };
  }

  if (
    actor.kind === "RECRUITER" &&
    currentAssignee &&
    currentAssignee.isContinuouslyEligible === true &&
    actor.companyMemberId != null &&
    String(actor.companyMemberId) === String(currentAssignee.companyMemberId)
  ) {
    return { canRead: true, canSendNormal: true, mode: "ACTIVE" };
  }

  return { canRead: false, canSendNormal: false, mode: "ACTIVE" };
};

export { evaluateApplicationConversationChatAuthority };
