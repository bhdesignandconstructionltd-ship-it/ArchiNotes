
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Meeting, NoteRow, NoteImage, MarkupPath, ToolType, ToolColor, Attendee } from '../types';
import { jsPDF } from 'jspdf';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Image as ImageIcon, 
  Users, 
  Calendar, 
  CheckCircle, 
  X, 
  FileText,
  Undo,
  Eraser,
  Highlighter,
  PenTool,
  Loader2,
  FileUp,
  ZoomIn,
  Download,
  FileDown,
  Check,
  ChevronDown,
  ChevronUp,
  Building2,
  UserPlus,
  Briefcase,
  User,
  ArrowLeft
} from 'lucide-react';
import DrawingCanvas from './DrawingCanvas';

if (typeof window !== 'undefined' && (window as any).pdfjsLib) {
  (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
}

interface MeetingViewProps {
  meeting: Meeting;
  onUpdate: (updatedMeeting: Meeting) => void;
  onClose: () => void;
}

const MeetingView: React.FC<MeetingViewProps> = ({ meeting, onUpdate, onClose }) => {
  const [editingMarkup, setEditingMarkup] = useState<{ rowId: string, imageId: string, url: string, markup: MarkupPath[] } | null>(null);
  const [whiteboardTool, setWhiteboardTool] = useState<ToolType>(ToolType.MARKER);
  const [whiteboardColor, setWhiteboardColor] = useState<ToolColor>('#ef4444');
  const [isDrawingWhiteboard, setIsDrawingWhiteboard] = useState(false);
  const [currentWhiteboardPath, setCurrentWhiteboardPath] = useState<{ x: number, y: number }[]>([]);
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  
  // Controls the visibility of the Stakeholders section
  const [attendeesExpanded, setAttendeesExpanded] = useState(false);
  const [attendeesVisible, setAttendeesVisible] = useState(true);

  const [exportConfig, setExportConfig] = useState({
    attendees: true,
    whiteboard: true,
    discussion: true
  });
  
  const [isZoomEnabled, setIsZoomEnabled] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 0, y: 0, show: false });
  const [whiteboardSize, setWhiteboardSize] = useState({ width: 1600, height: 160 });
  const [whiteboardScale, setWhiteboardScale] = useState(1);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const whiteboardImageInputRef = useRef<HTMLInputElement>(null);
  const whiteboardCanvasRef = useRef<HTMLCanvasElement>(null);
  const activeRowId = useRef<string | null>(null);

  const groupedAttendees = useMemo(() => {
    const groups: Record<string, Attendee[]> = {};
    (meeting.attendees || []).forEach(att => {
      const org = att.organisation?.trim() || 'Independent';
      if (!groups[org]) groups[org] = [];
      groups[org].push(att);
    });
    return groups;
  }, [meeting.attendees]);

  useEffect(() => {
    if (meeting.whiteboardImage) {
      const img = new Image();
      img.src = meeting.whiteboardImage;
      img.onload = () => {
        const maxWidth = 2000;
        const width = Math.min(img.width, maxWidth);
        const height = (img.height / img.width) * width;
        setWhiteboardSize({ width, height });
        setWhiteboardScale(1); 
      };
    } else {
      setWhiteboardSize({ width: 1600, height: 160 });
      setWhiteboardScale(1);
    }
  }, [meeting.whiteboardImage]);

  const addRow = () => {
    const newRow: NoteRow = {
      id: crypto.randomUUID(),
      discussion: '',
      followUp: '',
      images: []
    };
    onUpdate({ ...meeting, rows: [...meeting.rows, newRow] });
    setTimeout(() => {
      const workspace = document.getElementById('workspace-scroll');
      if (workspace) workspace.scrollTo({ top: workspace.scrollHeight, behavior: 'smooth' });
    }, 100);
  };

  const updateRow = (id: string, field: keyof NoteRow, value: any) => {
    const updatedRows = meeting.rows.map(row => 
      row.id === id ? { ...row, [field]: value } : row
    );
    onUpdate({ ...meeting, rows: updatedRows });
  };

  const deleteRow = (id: string) => {
    onUpdate({ ...meeting, rows: meeting.rows.filter(r => r.id !== id) });
  };

  const addAttendee = (org?: string) => {
    const newAttendee: Attendee = {
      id: crypto.randomUUID(),
      name: '',
      organisation: org || ''
    };
    onUpdate({ ...meeting, attendees: [...(meeting.attendees || []), newAttendee] });
    setAttendeesVisible(true);
    setAttendeesExpanded(true);
  };

  const updateAttendee = (id: string, field: keyof Attendee, value: string) => {
    const updatedAttendees = (meeting.attendees || []).map(att => 
      att.id === id ? { ...att, [field]: value } : att
    );
    onUpdate({ ...meeting, attendees: updatedAttendees });
  };

  const updateGroupOrganisation = (oldOrg: string, newOrg: string) => {
    const updatedAttendees = (meeting.attendees || []).map(att => 
      att.organisation === oldOrg ? { ...att, organisation: newOrg } : att
    );
    onUpdate({ ...meeting, attendees: updatedAttendees });
  };

  const removeAttendee = (id: string) => {
    onUpdate({ ...meeting, attendees: (meeting.attendees || []).filter(att => att.id !== id) });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, rowId: string) => {
    const file = e.target.files?.[0];
    if (file) processFile(file, rowId);
  };

  const handlePaste = (e: React.ClipboardEvent, rowId: string) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) processFile(file, rowId);
      }
    }
  };

  const processFile = (file: File, rowId: string) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      const newImage: NoteImage = {
        id: crypto.randomUUID(),
        url,
        markup: []
      };
      const row = meeting.rows.find(r => r.id === rowId);
      if (row) updateRow(rowId, 'images', [...row.images, newImage]);
    };
    reader.readAsDataURL(file);
  };

  const triggerUpload = (rowId: string) => {
    activeRowId.current = rowId;
    fileInputRef.current?.click();
  };

  const openMarkup = (rowId: string, image: NoteImage) => {
    setEditingMarkup({ rowId, imageId: image.id, url: image.url, markup: image.markup });
  };

  const saveMarkup = (newMarkup: MarkupPath[]) => {
    if (!editingMarkup) return;
    const { rowId, imageId } = editingMarkup;
    const updatedRows = meeting.rows.map(row => {
      if (row.id === rowId) {
        return {
          ...row,
          images: row.images.map(img => img.id === imageId ? { ...img, markup: newMarkup } : img)
        };
      }
      return row;
    });
    onUpdate({ ...meeting, rows: updatedRows });
    setEditingMarkup(null);
  };

  const deleteImage = (rowId: string, imageId: string) => {
      const row = meeting.rows.find(r => r.id === rowId);
      if (row) updateRow(rowId, 'images', row.images.filter(i => i.id !== imageId));
  };

  const renderWhiteboardFrame = useCallback(() => {
    const canvas = whiteboardCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (meeting.whiteboardImage) {
      const img = new Image();
      img.src = meeting.whiteboardImage;
      if (img.complete) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      } else {
        img.onload = () => renderWhiteboardFrame();
      }
    }
    
    const markup = meeting.whiteboardMarkup || [];
    markup.forEach(path => {
      ctx.beginPath();
      ctx.strokeStyle = path.color;
      ctx.lineWidth = path.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = path.isHighlighter ? 0.4 : 1.0;
      
      if (path.points.length > 0) {
        ctx.moveTo(path.points[0].x, path.points[0].y);
        path.points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();
      }
    });

    if (currentWhiteboardPath.length > 0) {
      ctx.beginPath();
      ctx.strokeStyle = whiteboardTool === ToolType.ERASER ? '#000000' : whiteboardColor;
      ctx.lineWidth = whiteboardTool === ToolType.HIGHLIGHTER ? 20 : 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = whiteboardTool === ToolType.HIGHLIGHTER ? 0.4 : 1.0;
      ctx.moveTo(currentWhiteboardPath[0].x, currentWhiteboardPath[0].y);
      currentWhiteboardPath.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.stroke();
    }
  }, [meeting.whiteboardMarkup, meeting.whiteboardImage, currentWhiteboardPath, whiteboardTool, whiteboardColor]);

  useEffect(() => {
    renderWhiteboardFrame();
  }, [renderWhiteboardFrame, meeting.whiteboardImage, whiteboardSize]);

  const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = whiteboardCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const startWhiteboardDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (isZoomEnabled) return;
    setIsDrawingWhiteboard(true);
    setCurrentWhiteboardPath([getCanvasCoords(e)]);
  };

  const handleWhiteboardDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (isZoomEnabled) {
      const rect = whiteboardCanvasRef.current?.getBoundingClientRect();
      if (rect) {
        const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const y = 'touches' in e ? e.touches[0].clientY : e.clientY;
        setZoomPos({ x: x - rect.left, y: y - rect.top, show: true });
      }
      return;
    }
    if (!isDrawingWhiteboard) return;
    setCurrentWhiteboardPath(prev => [...prev, getCanvasCoords(e)]);
  };

  const endWhiteboardDrawing = () => {
    if (isZoomEnabled) {
      setZoomPos(prev => ({ ...prev, show: false }));
      return;
    }
    if (!isDrawingWhiteboard) return;
    setIsDrawingWhiteboard(false);
    
    if (whiteboardTool === ToolType.ERASER) {
      const newMarkup = (meeting.whiteboardMarkup || []).filter(path => {
        return !path.points.some(pt1 => 
          currentWhiteboardPath.some(pt2 => Math.sqrt((pt1.x - pt2.x)**2 + (pt1.y - pt2.y)**2) < 30)
        );
      });
      onUpdate({ ...meeting, whiteboardMarkup: newMarkup });
    } else {
      const newPath: MarkupPath = {
        points: currentWhiteboardPath,
        color: whiteboardColor,
        width: whiteboardTool === ToolType.HIGHLIGHTER ? 20 : 3,
        isHighlighter: whiteboardTool === ToolType.HIGHLIGHTER
      };
      onUpdate({ ...meeting, whiteboardMarkup: [...(meeting.whiteboardMarkup || []), newPath] });
    }
    setCurrentWhiteboardPath([]);
  };

  const exportPDF = async () => {
    setIsExportingPdf(true);
    setShowExportModal(false);
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      let y = margin;

      doc.setFillColor(80, 200, 120); 
      doc.rect(0, 0, pageWidth, 25, 'F');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(0, 0, 0);
      doc.text("ARCHINOTES: DESIGN MEETING LOG", margin, 17);
      
      y = 35;
      doc.setFontSize(14);
      doc.setTextColor(40, 40, 40);
      doc.text(meeting.name.toUpperCase(), margin, y);
      y += 8;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`DATE: ${new Date(meeting.dateCreated).toLocaleDateString()}`, margin, y);
      y += 8;

      if (exportConfig.attendees && meeting.attendees?.length) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(60, 60, 60);
        doc.text("ATTENDEES (GROUPED BY ORGANISATION):", margin, y);
        y += 8;
        
        (Object.entries(groupedAttendees) as [string, Attendee[]][]).forEach(([org, atts]) => {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(80, 200, 120);
          doc.text(org.toUpperCase(), margin + 2, y);
          y += 5;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          doc.setTextColor(40, 40, 40);
          const names = atts.map(a => a.name || "Unnamed").join(", ");
          const nameLines = doc.splitTextToSize(names, pageWidth - margin * 2 - 10);
          doc.text(nameLines, margin + 7, y);
          y += nameLines.length * 5 + 3;
          if (y > pageHeight - 20) { doc.addPage(); y = margin + 10; }
        });
        y += 5;
      }

      if (exportConfig.whiteboard && whiteboardCanvasRef.current) {
        doc.setFont("helvetica", "bold");
        doc.text("SCRATCHPAD / WHITEBOARD SKETCH", margin, y);
        y += 5;
        const canvas = whiteboardCanvasRef.current;
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = pageWidth - (margin * 2);
        const imgHeight = (canvas.height / canvas.width) * imgWidth;
        const finalImgHeight = Math.min(imgHeight, 80);
        doc.addImage(imgData, 'PNG', margin, y, imgWidth, finalImgHeight);
        y += finalImgHeight + 15;
      }

      if (exportConfig.discussion) {
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("MEETING MINUTES & ACTIONS", margin, y);
        y += 8;
        meeting.rows.forEach((row, index) => {
          if (y > pageHeight - 40) { doc.addPage(); y = margin + 10; }
          doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(80, 200, 120);
          doc.text(`ITEM ${index + 1}`, margin, y); y += 5;
          doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(0, 0, 0);
          const discussionLines = doc.splitTextToSize(row.discussion || "No notes recorded.", (pageWidth - margin * 2) * 0.6);
          doc.text(discussionLines, margin, y);
          doc.setFont("helvetica", "italic"); doc.setTextColor(100, 100, 100);
          const followUpLines = doc.splitTextToSize(`ACTION: ${row.followUp || "-"}`, (pageWidth - margin * 2) * 0.35);
          doc.text(followUpLines, margin + (pageWidth - margin * 2) * 0.65, y);
          const maxHeight = Math.max(discussionLines.length * 5, followUpLines.length * 5);
          y += maxHeight + 10;
          doc.setDrawColor(230, 230, 230); doc.line(margin, y - 5, pageWidth - margin, y - 5);
        });
      }
      doc.save(`${meeting.name.replace(/\s+/g, '_')}_Notes.pdf`);
    } catch (error) {
      console.error("PDF Export failed:", error);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-appBg overflow-hidden relative">
      {/* Dynamic Header with 'Close Tab' capability */}
      <div className="border-b border-borderMain bg-sidebarBg px-8 py-6 flex-shrink-0 z-20">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 mb-6">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <button 
                onClick={onClose}
                className="p-2 bg-appBg hover:text-emeraldArch text-textMuted rounded-xl border border-borderMain transition-all shadow-sm"
                title="Close Meeting Log"
            >
                <ArrowLeft size={20} />
            </button>
            <div className="p-3 bg-emeraldArch/10 text-emeraldArch rounded-xl shrink-0 border border-emeraldArch/20">
              <Calendar size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <input 
                type="text"
                value={meeting.name}
                onChange={(e) => onUpdate({ ...meeting, name: e.target.value })}
                className="text-2xl font-bold text-textMain bg-transparent border-none focus:outline-none focus:ring-0 w-full p-0 leading-tight placeholder:text-textMuted"
                placeholder="Meeting Title"
              />
              <p className="text-sm text-textMuted font-medium">Recorded on {new Date(meeting.dateCreated).toLocaleDateString()}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button 
              onClick={addRow}
              className="flex items-center space-x-2 px-6 py-3 bg-emeraldArch text-black rounded-xl transition-all font-black shadow-lg shadow-emeraldArch/10 hover:opacity-90 active:scale-95"
            >
              <Plus size={18} />
              <span>Add Discussion Point</span>
            </button>
            <button 
              onClick={() => setShowExportModal(true)}
              disabled={isExportingPdf}
              className="flex items-center space-x-2 px-6 py-3 bg-sidebarBg hover:bg-appBg text-emeraldArch border border-emeraldArch/20 rounded-xl transition-all font-bold shadow-lg shadow-emeraldArch/5 disabled:opacity-50"
            >
              {isExportingPdf ? <Loader2 size={18} className="animate-spin" /> : <FileDown size={18} />}
              <span>Export PDF</span>
            </button>
          </div>
        </div>

        {/* Grouped Attendees Tab Section - Closable and Reopenable */}
        {attendeesVisible ? (
            <div className="bg-cardBg border border-borderMain rounded-xl shadow-xl mb-4 overflow-hidden transition-all duration-300">
              <div className="flex items-center justify-between p-4 bg-appBg/20">
                <button 
                    onClick={() => setAttendeesExpanded(!attendeesExpanded)}
                    className="flex-1 flex items-center space-x-3 hover:bg-appBg/40 transition-colors py-1 rounded-lg"
                >
                  <Users className="text-emeraldArch shrink-0" size={20} />
                  <div className="text-left">
                    <label className="text-[10px] font-bold text-textMuted uppercase tracking-widest block leading-none">Stakeholders & Attendees</label>
                    <p className="text-xs text-textMuted mt-0.5">
                      {Object.keys(groupedAttendees).length} Organization Tabs • {meeting.attendees?.length || 0} Total
                    </p>
                  </div>
                  {attendeesExpanded ? <ChevronUp className="text-textMuted" size={16} /> : <ChevronDown className="text-textMuted" size={16} />}
                </button>
                <div className="flex items-center space-x-2">
                    <button 
                        onClick={() => addAttendee()}
                        className="p-1.5 bg-emeraldArch/10 text-emeraldArch hover:bg-emeraldArch/20 rounded-lg transition-all"
                        title="Add New Organization"
                    >
                        <UserPlus size={16} />
                    </button>
                    <button 
                        onClick={() => setAttendeesVisible(false)}
                        className="p-1.5 text-textMuted hover:text-red-500 rounded-lg transition-all"
                        title="Close Attendees Section"
                    >
                        <X size={16} />
                    </button>
                </div>
              </div>

              {attendeesExpanded && (
                <div className="px-6 pb-6 border-t border-borderMain animate-in slide-in-from-top-2 duration-200">
                    <div className="flex flex-col space-y-4 pt-4 max-h-[350px] overflow-y-auto scrollbar-hide">
                        {(Object.entries(groupedAttendees) as [string, Attendee[]][]).map(([org, atts]) => (
                          <div key={org} className="bg-appBg rounded-xl border border-borderMain p-4 space-y-3 shadow-inner">
                            <div className="flex items-center space-x-3 border-b border-borderMain pb-2">
                              <Building2 size={14} className="text-emeraldArch" />
                              <input 
                                type="text"
                                value={org}
                                onChange={(e) => updateGroupOrganisation(org, e.target.value)}
                                placeholder="Organisation Name"
                                className="bg-transparent border-none text-[11px] font-black text-textMain uppercase tracking-wider focus:ring-0 p-0 w-full placeholder:text-textMuted/40"
                              />
                              <button 
                                onClick={() => addAttendee(org)}
                                className="shrink-0 p-1 text-emeraldArch hover:bg-emeraldArch/10 rounded transition-colors"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                            
                            <div className="flex flex-wrap gap-2">
                              {atts.map((att) => (
                                <div key={att.id} className="flex items-center bg-cardBg border border-borderMain rounded-lg px-3 py-2 group/person hover:border-emeraldArch/30 transition-all">
                                  <User size={12} className="text-textMuted mr-2" />
                                  <input 
                                    type="text"
                                    value={att.name}
                                    onChange={(e) => updateAttendee(att.id, 'name', e.target.value)}
                                    placeholder="Name"
                                    className="bg-transparent border-none text-xs text-textMain focus:ring-0 p-0 min-w-[100px] placeholder:text-textMuted/40"
                                  />
                                  <button 
                                    onClick={() => removeAttendee(att.id)}
                                    className="ml-2 text-textMuted hover:text-red-500 opacity-0 group-hover/person:opacity-100 transition-opacity"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                    </div>
                </div>
              )}
            </div>
        ) : (
            <div className="mb-4">
                <button 
                    onClick={() => setAttendeesVisible(true)}
                    className="flex items-center space-x-2 px-4 py-2 bg-sidebarBg border border-borderMain rounded-xl text-xs font-bold text-textMuted hover:text-emeraldArch transition-all shadow-sm"
                >
                    <Users size={14} />
                    <span>Reopen Attendees Tab</span>
                </button>
            </div>
        )}

        {/* Whiteboard - Sticky Area */}
        <div className="bg-cardBg border border-borderMain rounded-xl overflow-hidden shadow-2xl relative">
          <div className="flex items-center justify-between px-4 py-2 bg-appBg/40 border-b border-borderMain">
            <div className="flex items-center space-x-2 text-[10px] font-bold text-textMuted uppercase tracking-widest">
              <Edit3 size={14} className="text-emeraldArch" />
              <span>Project Scratchpad</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex items-center bg-sidebarBg rounded-lg p-1 space-x-1 border border-borderMain">
                <button onClick={() => whiteboardImageInputRef.current?.click()} className="p-1.5 rounded text-textMuted hover:text-emeraldArch" title="Upload Image"><FileUp size={14} /></button>
                <button onClick={() => setIsZoomEnabled(!isZoomEnabled)} className={`p-1.5 rounded transition-colors ${isZoomEnabled ? 'bg-emeraldArch text-black' : 'text-textMuted hover:text-textMain'}`}><ZoomIn size={14} /></button>
                <div className="w-px h-3 bg-borderMain mx-0.5" />
                <button onClick={() => { setWhiteboardTool(ToolType.MARKER); setWhiteboardColor('#ef4444'); }} className={`p-1.5 rounded transition-colors ${whiteboardTool === ToolType.MARKER && whiteboardColor === '#ef4444' ? 'bg-red-600/20 text-red-400' : 'text-textMuted hover:text-textMain'}`}><PenTool size={14} /></button>
                <button onClick={() => { setWhiteboardTool(ToolType.HIGHLIGHTER); setWhiteboardColor('#facc15'); }} className={`p-1.5 rounded transition-colors ${whiteboardTool === ToolType.HIGHLIGHTER ? 'bg-yellow-600/20 text-yellow-400' : 'text-textMuted hover:text-textMain'}`}><Highlighter size={14} /></button>
                <button onClick={() => { setWhiteboardTool(ToolType.ERASER); }} className={`p-1.5 rounded transition-colors ${whiteboardTool === ToolType.ERASER ? 'bg-textMuted text-white' : 'text-textMuted hover:text-textMain'}`}><Eraser size={14} /></button>
              </div>
              <div className="flex items-center bg-sidebarBg rounded-lg p-1 space-x-1 border border-borderMain">
                <button onClick={() => onUpdate({ ...meeting, whiteboardMarkup: (meeting.whiteboardMarkup || []).slice(0, -1) })} className="p-1.5 text-textMuted hover:text-textMain"><Undo size={14} /></button>
                <button onClick={() => onUpdate({ ...meeting, whiteboardMarkup: [], whiteboardImage: undefined })} className="p-1.5 text-textMuted hover:text-red-400"><Trash2 size={14} /></button>
                <button onClick={() => {
                  const canvas = whiteboardCanvasRef.current;
                  if (canvas) {
                    const link = document.createElement('a');
                    link.download = 'whiteboard.png';
                    link.href = canvas.toDataURL();
                    link.click();
                  }
                }} className="p-1.5 text-emeraldArch hover:text-textMain"><Download size={14} /></button>
              </div>
            </div>
          </div>
          <div className="bg-appBg relative overflow-auto flex items-center justify-center transition-[height] duration-300 scrollbar-hide" style={{ height: meeting.whiteboardImage ? 'auto' : '160px', maxHeight: '400px', cursor: 'crosshair' }}>
            <div className="relative p-10" style={{ width: whiteboardSize.width * whiteboardScale, height: whiteboardSize.height * whiteboardScale }}>
                <canvas 
                    ref={whiteboardCanvasRef} width={whiteboardSize.width} height={whiteboardSize.height}
                    className="block shadow-2xl"
                    style={{ width: whiteboardSize.width * whiteboardScale, height: whiteboardSize.height * whiteboardScale }}
                    onMouseDown={startWhiteboardDrawing} onMouseMove={handleWhiteboardDrawing} onMouseUp={endWhiteboardDrawing} onMouseLeave={endWhiteboardDrawing}
                />
            </div>
          </div>
        </div>
      </div>

      <div id="workspace-scroll" className="flex-1 overflow-auto bg-appBg p-8 scroll-smooth">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="grid grid-cols-12 gap-6 px-4 mb-2 items-center sticky top-0 bg-appBg/80 backdrop-blur-md z-10 py-4 border-b border-borderMain">
            <div className="col-span-7 flex items-center space-x-2">
              <Edit3 size={14} className="text-textMuted" />
              <span className="text-[10px] font-bold text-textMuted uppercase tracking-widest">Discussion / Design Brief</span>
            </div>
            <div className="col-span-4 flex items-center space-x-2">
              <CheckCircle size={14} className="text-textMuted" />
              <span className="text-[10px] font-bold text-textMuted uppercase tracking-widest">Parties to Follow Up</span>
            </div>
          </div>

          {meeting.rows.map((row) => (
            <div key={row.id} className="grid grid-cols-12 gap-6 group">
              <div className="col-span-7 bg-cardBg rounded-xl border border-borderMain overflow-hidden flex flex-col focus-within:ring-2 focus-within:ring-emeraldArch/20 transition-all">
                <textarea 
                  value={row.discussion}
                  onChange={(e) => updateRow(row.id, 'discussion', e.target.value)}
                  onPaste={(e) => handlePaste(e, row.id)}
                  placeholder="Discussion points, sketches..."
                  className="w-full p-5 min-h-[120px] bg-transparent resize-none focus:outline-none text-textMain leading-relaxed font-normal text-sm"
                />
                {row.images.length > 0 && (
                  <div className="p-4 bg-appBg border-t border-borderMain flex flex-wrap gap-4">
                    {row.images.map((img) => (
                      <div key={img.id} className="relative group/img overflow-hidden rounded-lg border border-borderMain bg-sidebarBg">
                        <img src={img.url} alt="Markup" className="h-32 w-48 object-cover cursor-pointer hover:opacity-80" onClick={() => openMarkup(row.id, img)} />
                        <div className="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover/img:opacity-100 transition-opacity">
                            <button onClick={() => openMarkup(row.id, img)} className="p-1.5 bg-emeraldArch text-black rounded shadow-lg"><Edit3 size={14} /></button>
                            <button onClick={() => deleteImage(row.id, img.id)} className="p-1.5 bg-red-600 text-white rounded shadow-lg"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="px-5 py-3 border-t border-borderMain flex items-center justify-between bg-appBg/20">
                  <button onClick={() => triggerUpload(row.id)} className="flex items-center space-x-2 text-xs font-bold text-emeraldArch hover:text-textMain uppercase tracking-wider">
                    <ImageIcon size={14} /> <span>Add Sketch</span>
                  </button>
                </div>
              </div>
              <div className="col-span-4 bg-cardBg rounded-xl border border-borderMain overflow-hidden flex flex-col">
                <textarea 
                  value={row.followUp}
                  onChange={(e) => updateRow(row.id, 'followUp', e.target.value)}
                  placeholder="Action items..."
                  className="w-full p-5 flex-1 bg-transparent resize-none focus:outline-none text-emeraldArch italic border-l-2 border-emeraldArch/10 focus:border-emeraldArch text-sm"
                />
              </div>
              <div className="col-span-1 flex items-center justify-center">
                <button onClick={() => deleteRow(row.id)} className="p-3 text-textMuted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={20} /></button>
              </div>
            </div>
          ))}

          {meeting.rows.length === 0 && (
            <div className="text-center py-24 bg-cardBg rounded-3xl border border-dashed border-borderMain">
                <FileText size={48} className="mx-auto text-textMuted mb-4" />
                <h3 className="text-lg font-bold text-textMuted">No meeting items yet</h3>
                <button onClick={addRow} className="mt-4 px-6 py-2 bg-emeraldArch text-black rounded-xl font-bold">Add First Discussion Point</button>
            </div>
          )}
        </div>
      </div>

      <div className="absolute bottom-10 right-10 z-40">
        <button onClick={addRow} className="w-14 h-14 bg-emeraldArch text-black rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all group">
          <Plus size={28} className="group-hover:rotate-90 transition-transform duration-300" />
        </button>
      </div>

      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => { if (activeRowId.current) handleImageUpload(e, activeRowId.current); }} />
      <input type="file" ref={whiteboardImageInputRef} className="hidden" accept="image/*,application/pdf" onChange={async (e) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => onUpdate({ ...meeting, whiteboardImage: event.target?.result as string });
          reader.readAsDataURL(file);
        }
      }} />

      {editingMarkup && (
        <DrawingCanvas imageUrl={editingMarkup.url} initialMarkup={editingMarkup.markup} onCancel={() => setEditingMarkup(null)} onSave={saveMarkup} />
      )}
    </div>
  );
};

export default MeetingView;
