import { z } from 'zod';

export const MeetingCreateSchema = z.object({
  title: z
    .string()
    .min(2, { message: 'Meeting title must be at least 2 characters' })
    .max(120, { message: 'Meeting title must be under 120 characters' }),
  description: z.string().max(500).optional(),
});

export const ActionItemSchema = z.object({
  title: z.string().min(3, { message: 'Action title required' }),
  description: z.string().optional(),
  owner: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  status: z.enum(['todo', 'in_progress', 'completed', 'cancelled']).default('todo'),
  sourceSegmentIds: z.array(z.string()).default([]),
});

export const DecisionSchema = z.object({
  title: z.string().min(3),
  rationale: z.string().optional(),
  consensusLevel: z.enum(['agreed', 'majority', 'tentative']).default('agreed'),
  sourceSegmentIds: z.array(z.string()).default([]),
});

export const MOMStructuredOutputSchema = z.object({
  meetingTitle: z.string(),
  executiveSummary: z.string().min(10),
  agendaTopics: z.array(z.string()),
  keyDiscussionPoints: z.array(z.string()),
  decisions: z.array(DecisionSchema),
  actionItems: z.array(ActionItemSchema),
  risksAndBlockers: z.array(
    z.object({
      title: z.string(),
      mitigation: z.string().optional(),
      severity: z.enum(['low', 'medium', 'high']),
      sourceSegmentIds: z.array(z.string()).default([]),
    })
  ),
  openQuestions: z.array(z.string()),
  nextSteps: z.array(z.string()),
  unsupportedClaimsWarnings: z.array(z.string()).optional(),
});

export type MeetingCreateFormValues = z.infer<typeof MeetingCreateSchema>;
export type ActionItemFormValues = z.infer<typeof ActionItemSchema>;
