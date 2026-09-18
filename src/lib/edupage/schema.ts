import { z } from 'zod';

export const RawPeriodSchema = z.object({
  id: z.string(),
  period: z.string(),
  name: z.string(),
  short: z.string().optional().default(''),
  starttime: z.string(),
  endtime: z.string()
}).passthrough();

export const RawDaysDefSchema = z.object({
  id: z.string(),
  vals: z.array(z.string()).optional().default([])
}).passthrough();

export const RawClassroomSchema = z.object({
  id: z.string(),
  name: z.string(),
  short: z.string().optional().default(''),
  buildingid: z.string().optional().default('')
}).passthrough();

export const RawClassSchema = z.object({
  id: z.string(),
  name: z.string(),
  short: z.string().optional().default('')
}).passthrough();

export const RawSubjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  short: z.string().optional().default('')
}).passthrough();

export const RawTeacherSchema = z.object({
  id: z.string(),
  name: z.string(),
  short: z.string().optional().default(''),
  nameprefix: z.string().optional().default(''),
  namesuffix: z.string().optional().default('')
}).passthrough();

export const RawLessonSchema = z.object({
  id: z.string(),
  subjectid: z.string().optional().default(''),
  teacherids: z.array(z.string()).optional().default([]),
  classroomids: z.array(z.string()).optional().default([]),
  groupids: z.array(z.string()).optional().default([]),
  classids: z.array(z.string()).optional().default([]),
  durationperiods: z.number().optional().default(1),
  count: z.number().optional().default(1),
  groupnames: z.array(z.string()).optional().default([])
}).passthrough();

export const RawCardSchema = z.object({
  id: z.string(),
  lessonid: z.string(),
  period: z.string(),
  days: z.string(),
  classroomids: z.array(z.string()).optional().default([]),
  weeks: z.string().optional().default(''),
  locked: z.boolean().optional().default(false)
}).passthrough();

export const RawTableSchema = z.object({
  id: z.string(),
  columns: z.array(z.string()).optional(),
  data_columns: z.array(z.string()).optional(),
  data_rows: z.array(z.record(z.any())).optional().default([])
}).passthrough();

export const RegularTtResponseSchema = z.object({
  r: z.object({
    dbiAccessorRes: z.object({
      tables: z.array(RawTableSchema)
    }).passthrough()
  }).passthrough()
}).passthrough();

export const TTViewerTimetableSchema = z.object({
  tt_num: z.string(),
  year: z.number().optional(),
  text: z.string(),
  datefrom: z.string().optional(),
  hidden: z.boolean().optional()
}).passthrough();

export const TTViewerResponseSchema = z.object({
  r: z.object({
    regular: z.object({
      default_num: z.string().optional(),
      timetables: z.array(TTViewerTimetableSchema).optional().default([])
    }).passthrough()
  }).passthrough()
}).passthrough();

export type RawPeriod = z.infer<typeof RawPeriodSchema>;
export type RawClassroom = z.infer<typeof RawClassroomSchema>;
export type RawClass = z.infer<typeof RawClassSchema>;
export type RawSubject = z.infer<typeof RawSubjectSchema>;
export type RawTeacher = z.infer<typeof RawTeacherSchema>;
export type RawLesson = z.infer<typeof RawLessonSchema>;
export type RawCard = z.infer<typeof RawCardSchema>;
export type RegularTtResponse = z.infer<typeof RegularTtResponseSchema>;
