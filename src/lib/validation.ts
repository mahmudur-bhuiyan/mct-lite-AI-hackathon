import { z } from "zod";

// Email validation
export const emailSchema = z.string().email("Invalid email address");

export function validateEmail(email: string): boolean {
  return emailSchema.safeParse(email).success;
}

export function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

// URL validation
export const urlSchema = z.string().url("Invalid URL");

export function validateUrl(url: string): boolean {
  return urlSchema.safeParse(url).success;
}

// String sanitization
export function sanitizeString(str: string): string {
  return str.trim().replace(/\s+/g, " ");
}

// Phone validation
export const phoneSchema = z.string().regex(/^\+?[\d\s\-()]+$/, "Invalid phone number");

export function validatePhone(phone: string): boolean {
  return phoneSchema.safeParse(phone).success;
}

// Form validation helpers
export function isRequired(value: any): boolean {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  return value !== null && value !== undefined;
}

export function minLength(value: string, min: number): boolean {
  return value.length >= min;
}

export function maxLength(value: string, max: number): boolean {
  return value.length <= max;
}

// Common validation schemas - aligned with form requirements
export const clientSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  company: z.string().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

export const MEETING_STATUSES = ["scheduled", "completed", "cancelled"] as const;
export type MeetingStatus = typeof MEETING_STATUSES[number];

export const MEETING_TYPES = ["manual", "borrower_appointment", "teams"] as const;
export type MeetingType = (typeof MEETING_TYPES)[number];

export const meetingSchema = z.object({
  title: z.string().min(1, "Title is required"),
  meeting_date: z.string().min(1, "Date is required"),
  duration_minutes: z.number().min(1, "Duration must be at least 1 minute").optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  client_id: z.string().optional().or(z.literal("")),
  loan_id: z.string().optional().or(z.literal("")),
  meeting_type: z.enum(MEETING_TYPES).optional(),
  zoom_meeting_id: z.string().optional(),
  zoom_join_url: z.string().optional(),
  status: z.enum(MEETING_STATUSES).optional(),
});

export const knowledgeEntrySchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  summary: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const taskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  status: z.string().min(1, "Status is required"),
  priority: z.string().min(1, "Priority is required"),
  due_date: z.string().optional(),
  assigned_to: z.string().optional().or(z.literal("")),
  client_id: z.string().optional().or(z.literal("")),
  meeting_id: z.string().optional().or(z.literal("")),
});

export type ClientFormData = z.infer<typeof clientSchema>;
export type MeetingFormData = z.infer<typeof meetingSchema>;
export type KnowledgeEntryFormData = z.infer<typeof knowledgeEntrySchema>;
export type TaskFormData = z.infer<typeof taskSchema>;

// Teams meeting creation schema with production-safe validation
export const createTeamsMeetingSchema = z.object({
  title: z.string()
    .min(1, "Title is required")
    .max(200, "Title must be less than 200 characters")
    .trim(),
  
  startDateTime: z.string()
    .min(1, "Start time is required")
    .refine((val) => {
      const date = new Date(val);
      return !isNaN(date.getTime());
    }, "Invalid start date/time")
    .refine((val) => {
      const date = new Date(val);
      // Allow 1 minute buffer for form submission
      return date.getTime() > Date.now() - 60000;
    }, "Start time must be in the future"),
  
  endDateTime: z.string()
    .min(1, "End time is required")
    .refine((val) => {
      const date = new Date(val);
      return !isNaN(date.getTime());
    }, "Invalid end date/time"),
  
  attendees: z.array(
    z.string().email("Invalid email address").trim().toLowerCase()
  ).optional().default([]),
}).refine((data) => {
  const start = new Date(data.startDateTime);
  const end = new Date(data.endDateTime);
  return end > start;
}, {
  message: "End time must be after start time",
  path: ["endDateTime"],
}).refine((data) => {
  const start = new Date(data.startDateTime);
  const end = new Date(data.endDateTime);
  const durationMs = end.getTime() - start.getTime();
  const maxDuration = 24 * 60 * 60 * 1000; // 24 hours
  return durationMs <= maxDuration;
}, {
  message: "Meeting cannot be longer than 24 hours",
  path: ["endDateTime"],
}).refine((data) => {
  const start = new Date(data.startDateTime);
  const end = new Date(data.endDateTime);
  const durationMs = end.getTime() - start.getTime();
  const minDuration = 5 * 60 * 1000; // 5 minutes
  return durationMs >= minDuration;
}, {
  message: "Meeting must be at least 5 minutes",
  path: ["endDateTime"],
});

export type CreateTeamsMeetingInput = z.infer<typeof createTeamsMeetingSchema>;
