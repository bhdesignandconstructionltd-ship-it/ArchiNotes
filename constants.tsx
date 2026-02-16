
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
    name: 'Harbor Residences',
    meetings: [
      {
        id: 'meet-1',
        name: 'Initial Briefing',
        dateCreated: new Date().toISOString(),
        attendees: [
          { id: 'att-1', name: 'John Architect', organisation: 'ArchiCore' },
          { id: 'att-2', name: 'Sarah Client', organisation: 'Marina Dev' }
        ],
        rows: [
          {
            id: 'row-1',
            discussion: 'Discussed the site orientation and view corridors.',
            followUp: 'Engineer to verify soil reports',
            images: []
          }
        ],
        whiteboardMarkup: []
      }
    ]
  }
];
