
import React from 'react';
import { Layout, Users, FileText, Image as ImageIcon, Plus, Trash2, Edit3, Save, ChevronLeft, ChevronRight, Undo, Redo, Eraser, Highlighter, PenTool } from 'lucide-react';

export const COLORS = {
  BLUE: '#3b82f6',
  RED: '#ef4444',
  GREEN: '#22c55e',
  YELLOW: '#facc15', // Highlighter
};

export const INITIAL_DATA = [
  {
    id: 'proj-1',
    name: 'PROJECT TITLE',
    meetings: [
      {
        id: 'meet-1',
        name: 'MEETING TITLE',
        dateCreated: new Date().toISOString(),
        attendees: [
          { id: 'att-1', name: 'Lead Architect', organisation: 'Organisation 1' },
          { id: 'att-2', name: 'Client Representative', organisation: 'Organisation 2' }
        ],
        rows: [
          {
            id: 'row-1',
            discussion: 'Welcome to your new architectural log. Start by adding notes, sketching on the scratchpad, or attaching site plans.',
            followUp: 'First action item goes here',
            images: []
          }
        ],
        whiteboardMarkup: []
      }
    ]
  }
];
