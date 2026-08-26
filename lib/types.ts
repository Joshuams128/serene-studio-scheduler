export type Instructor = {
  id: string;
  name: string;
  email: string | null;
  invite_token: string;
  formats_taught: string[];
  active: boolean;
  created_at: string;
};

export type AvailabilitySlot = {
  day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
  start: string; // "06:00"
  end: string; // "12:00"
};

export type AvailabilitySubmission = {
  id: string;
  instructor_id: string;
  period_start: string;
  available_slots: AvailabilitySlot[];
  preferences: string;
  submitted_at: string;
};

export type ClassRequirement = {
  id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  format: string;
  room: string | null;
  active: boolean;
};

export type ScheduleAssignment = {
  requirementId: string;
  day: string;
  start: string;
  end: string;
  format: string;
  instructorId: string | null;
  instructorName: string | null;
  note?: string;
};

export type Schedule = {
  id: string;
  period_start: string;
  status: "draft" | "approved";
  assignments: ScheduleAssignment[];
  notes: string;
  generated_at: string;
  approved_at: string | null;
};
