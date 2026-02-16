
export interface Attendee {
  id: string;
  name: string;
  organisation: string;
}

export interface MarkupPath {
  points: { x: number; y: number }[];
  color: string;
  width: number;
  isHighlighter: boolean;
}

export interface NoteImage {
  id: string;
  url: string;
  markup: MarkupPath[];
}

export interface NoteRow {
  id: string;
  discussion: string;
  followUp: string;
  images: NoteImage[];
}

export interface Meeting {
  id: string;
  name: string;
  dateCreated: string;
  attendees: Attendee[];
  rows: NoteRow[];
  whiteboardMarkup?: MarkupPath[];
  whiteboardImage?: string;
}

export interface ProjectGroup {
  id: string;
  name: string;
  meetings: Meeting[];
}

export enum ToolType {
  MARKER = 'MARKER',
  HIGHLIGHTER = 'HIGHLIGHTER',
  ERASER = 'ERASER'
}

export type ToolColor = '#3b82f6' | '#ef4444' | '#22c55e' | '#facc15'; // Blue, Red, Green, Yellow
