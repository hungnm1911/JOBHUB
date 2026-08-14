// Canonical SYSTEM Message content for V11 responsibility transitions.
// Content is Conversation context only — not Assignment History metadata.
const SYSTEM_MESSAGE_CONTENT = Object.freeze({
  RESPONSIBILITY_CHANGED: "The responsible recruiter has changed.",
  AWAITING_NEW_ASSIGNEE:
    "This application is waiting for a new responsible recruiter.",
  NEW_ASSIGNEE: "A new responsible recruiter has been assigned.",
});

export default SYSTEM_MESSAGE_CONTENT;
