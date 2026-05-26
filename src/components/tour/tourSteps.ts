import type { Step } from "react-joyride";

// ---------------------------------------------------------------------------
// Shared base steps (visible to all roles)
// ---------------------------------------------------------------------------
const dashboardStep: Step = {
  target: '[data-tour="dashboard"]',
  title: "Dashboard",
  content:
    "Your command center. See pipeline health, loan activity, and AI alerts at a glance.",
  disableBeacon: true,
  placement: "right",
};

const tasksStep: Step = {
  target: '[data-tour="tasks"]',
  title: "Tasks",
  content:
    "Track conditions, to-dos, and open items across your pipeline. Never miss a follow-up.",
  disableBeacon: true,
  placement: "right",
};

const knowledgeStep: Step = {
  target: '[data-tour="knowledge"]',
  title: "Knowledge Base",
  content:
    "Upload guidelines, product sheets, and compliance docs. AI can search them for you instantly.",
  disableBeacon: true,
  placement: "right",
};

const aiToolsStep: Step = {
  target: '[data-tour="ai-tools"]',
  title: "AI Tools",
  content:
    "AI Chat and AI Agents are your intelligent assistants — ask questions, automate tasks, and get smart summaries.",
  disableBeacon: true,
  placement: "right",
};

const profileStep: Step = {
  target: '[data-tour="profile"]',
  title: "Your Profile",
  content:
    'Access your profile, settings, and this tour anytime via "Take Tour" in this menu.',
  disableBeacon: true,
  placement: "left",
};

// ---------------------------------------------------------------------------
// Role-specific steps
// ---------------------------------------------------------------------------
const loansStep: Step = {
  target: '[data-tour="loans"]',
  title: "Loans",
  content:
    "View and manage all active loans. Drill into each file to see phases, conditions, and timeline events.",
  disableBeacon: true,
  placement: "right",
};

const borrowersStep: Step = {
  target: '[data-tour="borrowers"]',
  title: "Borrowers",
  content:
    "Borrower profiles, documents, co-borrowers, and portal access — all in one place.",
  disableBeacon: true,
  placement: "right",
};

const actionItemsStep: Step = {
  target: '[data-tour="action-items"]',
  title: "Action Items",
  content:
    "AI-generated action items surface what needs your attention most — ranked by urgency.",
  disableBeacon: true,
  placement: "right",
};

const notificationsStep: Step = {
  target: '[data-tour="notifications"]',
  title: "Notifications",
  content:
    "Real-time risk alerts, SLA warnings, and rate-lock expiry reminders land here.",
  disableBeacon: true,
  placement: "right",
};

// ---------------------------------------------------------------------------
// Exported step sets per role
// ---------------------------------------------------------------------------

/** Admin / Moderator — full feature set */
export const adminTourSteps: Step[] = [
  dashboardStep,
  loansStep,
  borrowersStep,
  tasksStep,
  actionItemsStep,
  knowledgeStep,
  notificationsStep,
  aiToolsStep,
  profileStep,
];

/** Loan Officer / Branch Manager */
export const loanOfficerTourSteps: Step[] = [
  dashboardStep,
  loansStep,
  borrowersStep,
  tasksStep,
  knowledgeStep,
  aiToolsStep,
  profileStep,
];

/** User (processor / support) — narrower nav */
export const userTourSteps: Step[] = [
  dashboardStep,
  tasksStep,
  knowledgeStep,
  aiToolsStep,
  profileStep,
];

export type TourVariant = "admin" | "loan_officer" | "user";

export function getTourSteps(variant: TourVariant): Step[] {
  switch (variant) {
    case "admin":
      return adminTourSteps;
    case "loan_officer":
      return loanOfficerTourSteps;
    case "user":
    default:
      return userTourSteps;
  }
}
