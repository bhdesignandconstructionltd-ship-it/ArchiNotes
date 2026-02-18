
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Meeting, NoteRow, NoteImage, MarkupPath, ToolType, ToolColor, Attendee } from '../types';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
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
  Redo,
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
  ArrowLeft,
  RotateCcw,
  CheckSquare,
  Square,
  Circle
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
  const [attendeesExpanded, setAttendeesExpanded] = useState(false);
  const [attendeesVisible, setAttendeesVisible] = useState(true);
  const [whiteboardSize, setWhiteboardSize] = useState({ width: 1600, height: 900 });
  const [whiteboardScale, setWhiteboardScale] = useState(1);
  const [redoStack, setRedoStack] = useState<MarkupPath[]>([]);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  
  // Export States
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [exportOptions, setExportOptions] = useState({
    attendees: true,
    whiteboard: true,
    entries: true
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const whiteboardImageInputRef = useRef<HTMLInputElement>(null);
  const whiteboardCanvasRef = useRef<HTMLCanvasElement>(null);
  const whiteboardContainerRef = useRef<HTMLDivElement>(null);
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

  // Utility to convert PDF to Image
  const processPdfFile = async (file: File): Promise<string> => {
    const pdfjsLib = (window as any).pdfjsLib;
    if (!pdfjsLib) throw new Error('PDF.js not loaded');

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1); // Process first page as background
    const viewport = page.getViewport({ scale: 2.5 }); // High res for architectural clarity
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not create canvas context');
    
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    await page.render({ canvasContext: context, viewport }).promise;
    return canvas.toDataURL('image/png');
  };

  const handleFileUpload = async (file: File, target: 'whiteboard' | 'row', rowId?: string) => {
    setIsProcessingFile(true);
    try {
      let resultUrl = '';
      if (file.type === 'application/pdf') {
        resultUrl = await processPdfFile(file);
      } else {
        resultUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });
      }

      if (target === 'whiteboard') {
        onUpdate({ ...meeting, whiteboardImage: resultUrl });
      } else if (target === 'row' && rowId) {
        const row = meeting.rows.find(r => r.id === rowId);
        if (row) {
          updateRow(rowId, 'images', [...row.images, { id: crypto.randomUUID(), url: resultUrl, markup: [] }]);
        }
      }
    } catch (error) {
      console.error('File processing failed:', error);
      alert('Failed to process file. Ensure it is a valid Image or PDF.');
    } finally {
      setIsProcessingFile(false);
    }
  };

  // Handle Shift+Ctrl+Scroll for zooming
  useEffect(() => {
    const container = whiteboardContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.shiftKey && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setWhiteboardScale(prev => Math.min(Math.max(prev + delta, 0.5), 5));
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  useEffect(() => {
    if (meeting.whiteboardImage) {
      const img = new Image();
      img.src = meeting.whiteboardImage;
      img.onload = () => {
        const maxWidth = 2000;
        const width = Math.min(img.width, maxWidth);
        const height = (img.height / img.width) * width;
        setWhiteboardSize({ width, height });
      };
    } else {
      setWhiteboardSize({ width: 1600, height: 900 });
    }
  }, [meeting.whiteboardImage]);

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
      const theme = document.documentElement.getAttribute('data-theme');
      ctx.strokeStyle = whiteboardTool === ToolType.ERASER ? (theme === 'day' ? '#F5F5F5' : '#282828') : whiteboardColor;
      ctx.lineWidth = whiteboardTool === ToolType.HIGHLIGHTER ? 30 : 4;
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
    const clientX = 'touches' in e ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;
    
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { 
      x: (clientX - rect.left) * scaleX, 
      y: (clientY - rect.top) * scaleY 
    };
  };

  const startWhiteboardDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawingWhiteboard(true);
    setCurrentWhiteboardPath([getCanvasCoords(e)]);
  };

  const endWhiteboardDrawing = () => {
    if (!isDrawingWhiteboard) return;
    setIsDrawingWhiteboard(false);
    
    if (whiteboardTool === ToolType.ERASER) {
      const newMarkup = (meeting.whiteboardMarkup || []).filter(path => {
        return !path.points.some(pt1 => 
          currentWhiteboardPath.some(pt2 => Math.sqrt((pt1.x - pt2.x)**2 + (pt1.y - pt2.y)**2) < 20)
        );
      });
      onUpdate({ ...meeting, whiteboardMarkup: newMarkup });
    } else {
      const newPath: MarkupPath = {
        points: currentWhiteboardPath,
        color: whiteboardColor,
        width: whiteboardTool === ToolType.HIGHLIGHTER ? 30 : 4,
        isHighlighter: whiteboardTool === ToolType.HIGHLIGHTER
      };
      onUpdate({ ...meeting, whiteboardMarkup: [...(meeting.whiteboardMarkup || []), newPath] });
    }
    setRedoStack([]);
    setCurrentWhiteboardPath([]);
  };

  const undoWhiteboard = () => {
    const markup = meeting.whiteboardMarkup || [];
    if (markup.length === 0) return;
    const last = markup[markup.length - 1];
    setRedoStack(prev => [...prev, last]);
    onUpdate({ ...meeting, whiteboardMarkup: markup.slice(0, -1) });
  };

  const redoWhiteboard = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    onUpdate({ ...meeting, whiteboardMarkup: [...(meeting.whiteboardMarkup || []), next] });
  };

  const addRow = () => {
    const newRow: NoteRow = { id: crypto.randomUUID(), discussion: '', followUp: '', images: [] };
    onUpdate({ ...meeting, rows: [...meeting.rows, newRow] });
    setTimeout(() => {
      const workspace = document.getElementById('workspace-scroll');
      if (workspace) workspace.scrollTo({ top: workspace.scrollHeight, behavior: 'smooth' });
    }, 100);
  };

  const updateRow = (id: string, field: keyof NoteRow, value: any) => {
    const updatedRows = meeting.rows.map(row => row.id === id ? { ...row, [field]: value } : row);
    onUpdate({ ...meeting, rows: updatedRows });
  };

  const handlePasteImage = (e: React.ClipboardEvent, rowId: string) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          handleFileUpload(file, 'row', rowId);
        }
      }
    }
  };

  const triggerUpload = (rowId: string) => {
    activeRowId.current = rowId;
    fileInputRef.current?.click();
  };

  const removeImage = (rowId: string, imgId: string) => {
    const row = meeting.rows.find(r => r.id === rowId);
    if (row) {
        updateRow(rowId, 'images', row.images.filter(i => i.id !== imgId));
    }
  };

  const downloadWhiteboard = () => {
    const canvas = whiteboardCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `Scratchpad_${meeting.name.replace(/\s+/g, '_')}.png`;
    link.href = dataUrl;
    link.click();
  };

  // Simplified PDF Export Logic to match Screenshot
  const handleExportPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      let currentY = 0;

      const addFooter = (pageNum: number, totalPages: number) => {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(150);
        const footerText = `Page ${pageNum} of ${totalPages} | Generated by ArchiNotes`;
        doc.text(footerText, pageWidth / 2, pageHeight - 10, { align: 'center' });
      };

      // 1. Emerald Header Bar
      doc.setFillColor(80, 200, 120); // emeraldArch
      doc.rect(0, 0, pageWidth, 20, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(0);
      doc.text("ARCHINOTES: DESIGN MEETING LOG", margin, 13);
      
      currentY = 35;

      // 2. Meeting Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(40);
      doc.text(meeting.name.toUpperCase(), margin, currentY);
      currentY += 8;

      // 3. Date Metadata
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`DATE: ${new Date(meeting.dateCreated).toLocaleDateString()}`, margin, currentY);
      currentY += 12;

      // 4. Section: Stakeholders (if selected)
      if (exportOptions.attendees && meeting.attendees?.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(80);
        doc.text("STAKEHOLDERS", margin, currentY);
        currentY += 6;
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(60);
        
        const attendeeText = meeting.attendees.map(a => `${a.name} (${a.organisation || 'N/A'})`).join(', ');
        const lines = doc.splitTextToSize(attendeeText, pageWidth - margin * 2);
        doc.text(lines, margin, currentY);
        currentY += (lines.length * 5) + 10;
      }

      // 5. Section Heading: Minutes
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(80);
      doc.text("MEETING MINUTES & ACTIONS", margin, currentY);
      currentY += 4;
      doc.setDrawColor(230);
      doc.line(margin, currentY, pageWidth - margin, currentY);
      currentY += 10;

      // 6. Entries (if selected)
      if (exportOptions.entries) {
        meeting.rows.forEach((row, idx) => {
          if (currentY > pageHeight - 40) {
            doc.addPage();
            currentY = margin;
          }
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(80, 200, 120);
          doc.text(`ITEM ${idx + 1}`, margin, currentY);
          currentY += 5;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          doc.setTextColor(30);
          const discLines = doc.splitTextToSize(row.discussion, (pageWidth - margin * 2) * 0.6);
          doc.text(discLines, margin, currentY);
          if (row.followUp) {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(10);
            doc.setTextColor(100);
            const actionText = `ACTION: ${row.followUp}`;
            const actionLines = doc.splitTextToSize(actionText, (pageWidth - margin * 2) * 0.35);
            doc.text(actionLines, pageWidth - margin, currentY, { align: 'right' });
            currentY += Math.max(discLines.length * 5, actionLines.length * 5) + 8;
          } else {
            currentY += (discLines.length * 5) + 8;
          }
        });
      }

      // 7. Whiteboard (if selected)
      if (exportOptions.whiteboard && (meeting.whiteboardImage || (meeting.whiteboardMarkup && meeting.whiteboardMarkup.length > 0))) {
        doc.addPage();
        currentY = margin;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(80);
        doc.text("PROJECT SCRATCHPAD", margin, currentY);
        currentY += 10;
        const whiteboardEl = document.getElementById('pdf-section-whiteboard');
        if (whiteboardEl) {
          const canvas = await html2canvas(whiteboardEl, { scale: 2 });
          const imgData = canvas.toDataURL('image/png');
          const imgWidth = pageWidth - margin * 2;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;
          doc.addImage(imgData, 'PNG', margin, currentY, imgWidth, imgHeight);
        }
      }

      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        addFooter(i, totalPages);
      }
      doc.save(`ArchiNote_${meeting.name.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error('PDF Generation Failed:', error);
      alert('Could not generate PDF. Please try again.');
    } finally {
      setIsGeneratingPdf(false);
      setIsExportModalOpen(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-appBg overflow-hidden relative">
      {/* Fixed Sticky Header for main actions */}
      <div className="px-8 py-6 flex-shrink-0 z-30 bg-appBg/95 backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div className="flex items-center space-x-6 flex-1 min-w-0">
            <button onClick={onClose} className="nm-btn p-3 rounded-2xl text-textMuted hover:text-emeraldArch transition-all shadow-sm">
                <ArrowLeft size={18} />
            </button>
            <div className="flex-1 min-w-0">
              <input 
                type="text"
                value={meeting.name}
                onChange={(e) => onUpdate({ ...meeting, name: e.target.value })}
                className="text-2xl font-black text-textMain bg-transparent border-none focus:outline-none focus:ring-0 w-full p-0 leading-tight placeholder:text-textMuted/40 uppercase tracking-tighter"
                placeholder="Log Entry Title"
              />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emeraldArch mt-1">DRAFTED: {new Date(meeting.dateCreated).toLocaleDateString()}</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {isProcessingFile && <div className="flex items-center space-x-2 text-[10px] font-black uppercase text-emeraldArch animate-pulse"><Loader2 size={12} className="animate-spin" /><span>Processing Asset...</span></div>}
            <button onClick={addRow} className="nm-emerald px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all">Add Entry</button>
            <button 
              onClick={() => setIsExportModalOpen(true)}
              className="nm-btn px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest text-emeraldArch"
            >
              Export Log
            </button>
          </div>
        </div>
      </div>

      {/* Main scrollable area containing Attendees, Whiteboard, and Entries */}
      <div id="workspace-scroll" className="flex-1 overflow-auto p-8 pt-2 space-y-8 scrollbar-hide">
        <div className="max-w-7xl mx-auto space-y-8">
          
          <div id="pdf-section-attendees">
          {attendeesVisible && (
              <div className="nm-raised rounded-3xl mb-0 overflow-hidden">
                <div className="flex items-center justify-between p-4">
                  <button onClick={() => setAttendeesExpanded(!attendeesExpanded)} className="flex items-center space-x-4">
                    <div className={`p-2 nm-inset rounded-xl text-emeraldArch transition-transform ${attendeesExpanded ? 'rotate-180' : ''}`}><ChevronDown size={14} /></div>
                    <span className="text-[10px] font-black uppercase tracking-widest">Stakeholders & Attendees</span>
                  </button>
                  <div className="flex items-center space-x-3">
                      <button onClick={() => {
                          const newAttendee: Attendee = { id: crypto.randomUUID(), name: '', organisation: '' };
                          onUpdate({ ...meeting, attendees: [...(meeting.attendees || []), newAttendee] });
                          setAttendeesExpanded(true);
                      }} className="nm-btn p-2 rounded-xl text-emeraldArch"><UserPlus size={14} /></button>
                      <button onClick={() => setAttendeesVisible(false)} className="nm-btn p-2 rounded-xl text-textMuted"><X size={14} /></button>
                  </div>
                </div>

                {attendeesExpanded && (
                  <div className="px-6 pb-6 space-y-4">
                      {Object.entries(groupedAttendees).map(([org, atts]) => (
                        <div key={org} className="nm-inset p-4 rounded-2xl space-y-4">
                          <div className="flex items-center justify-between border-b border-textMuted/10 pb-1">
                             <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emeraldArch">{org}</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {(atts as Attendee[]).map((att) => (
                              <div key={att.id} className="nm-raised px-3 py-1.5 rounded-xl flex items-center group">
                                <input 
                                  value={att.name}
                                  onChange={(e) => {
                                      const updated = (meeting.attendees || []).map(a => a.id === att.id ? { ...a, name: e.target.value } : a);
                                      onUpdate({ ...meeting, attendees: updated });
                                  }}
                                  className="text-[11px] font-bold bg-transparent border-none focus:outline-none w-20"
                                  placeholder="Name..."
                                />
                                <X size={8} className="text-textMuted hover:text-red-500 cursor-pointer ml-2" onClick={() => onUpdate({ ...meeting, attendees: (meeting.attendees || []).filter(a => a.id !== att.id) })} />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
          )}
          </div>

          <div id="pdf-section-whiteboard" className="nm-raised rounded-[28px] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-3 bg-appBg/40">
              <div className="flex items-center space-x-4">
                  <span className="text-[9px] font-black uppercase tracking-widest text-textMuted">Project Scratchpad</span>
                  <div className="nm-inset px-3 py-1 rounded-full text-[9px] font-mono font-bold text-emeraldArch">
                      SCALE: {whiteboardScale.toFixed(1)}x <span className="opacity-40 text-textMain ml-2">(Shift+Ctrl+Scroll)</span>
                  </div>
              </div>
              
              <div className="flex items-center space-x-3">
                  <div className="flex nm-inset p-1 rounded-xl space-x-1">
                      {['#ef4444', '#3b82f6', '#22c55e'].map(c => (
                          <button 
                              key={c}
                              onClick={() => { setWhiteboardTool(ToolType.MARKER); setWhiteboardColor(c as ToolColor); }}
                              className={`p-1.5 rounded-lg transition-all flex items-center justify-center ${whiteboardTool === ToolType.MARKER && whiteboardColor === c ? 'nm-inset text-emeraldArch' : 'nm-btn text-textMuted'}`}
                              style={{ color: c }}
                          >
                             <PenTool size={16} className="stroke-[3px]" />
                          </button>
                      ))}
                  </div>
                  <div className="w-px h-4 bg-textMuted/20 mx-1" />
                  <button onClick={() => setWhiteboardTool(ToolType.HIGHLIGHTER)} className={`nm-btn p-2 rounded-xl transition-all ${whiteboardTool === ToolType.HIGHLIGHTER ? 'nm-btn-active text-yellow-500' : 'text-textMuted'}`} title="Highlighter"><Highlighter size={16} /></button>
                  <button onClick={() => setWhiteboardTool(ToolType.ERASER)} className={`nm-btn p-2 rounded-xl transition-all ${whiteboardTool === ToolType.ERASER ? 'nm-btn-active text-red-500' : 'text-textMuted'}`} title="Eraser"><Eraser size={16} /></button>
                  <div className="w-px h-4 bg-textMuted/20 mx-1" />
                  <button onClick={undoWhiteboard} className="nm-btn p-2 rounded-xl text-textMuted hover:text-emeraldArch" title="Undo"><Undo size={16} /></button>
                  <button onClick={redoWhiteboard} className="nm-btn p-2 rounded-xl text-textMuted hover:text-emeraldArch" title="Redo"><Redo size={16} /></button>
                  <div className="w-px h-4 bg-textMuted/20 mx-1" />
                  <button onClick={() => whiteboardImageInputRef.current?.click()} className="nm-btn p-2 rounded-xl text-textMuted hover:text-emeraldArch" title="Import Plan (IMG/PDF)"><FileUp size={16} /></button>
                  <button onClick={downloadWhiteboard} className="nm-btn p-2 rounded-xl text-emeraldArch hover:text-emeraldArch" title="Download Scratchpad"><Download size={16} /></button>
              </div>
            </div>
            
            <div 
              ref={whiteboardContainerRef}
              className="nm-inset m-4 rounded-2xl overflow-hidden bg-black/5 relative cursor-crosshair flex items-center justify-center transition-all duration-300" 
              style={{ 
                height: 'auto',
                minHeight: '400px',
                // Removed forced maxHeight to allow tall architectural plans to grow and the user to scroll past them
              }}
            >
               <canvas 
                  ref={whiteboardCanvasRef} 
                  width={whiteboardSize.width} 
                  height={whiteboardSize.height} 
                  className="max-w-full h-auto w-auto"
                  style={{ 
                      transform: `scale(${whiteboardScale})`, 
                      transformOrigin: 'center center',
                      transition: 'transform 0.1s ease-out',
                      imageRendering: 'pixelated'
                  }}
                  onMouseDown={startWhiteboardDrawing}
                  onMouseMove={(e) => {
                      if (!isDrawingWhiteboard) return;
                      const coords = getCanvasCoords(e);
                      setCurrentWhiteboardPath(prev => [...prev, coords]);
                  }}
                  onMouseUp={endWhiteboardDrawing}
                  onMouseLeave={endWhiteboardDrawing}
                  onTouchStart={startWhiteboardDrawing}
                  onTouchMove={(e) => {
                      if (!isDrawingWhiteboard) return;
                      const coords = getCanvasCoords(e);
                      setCurrentWhiteboardPath(prev => [...prev, coords]);
                  }}
                  onTouchEnd={endWhiteboardDrawing}
               />
               {isProcessingFile && (
                 <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px] flex items-center justify-center z-50">
                    <div className="nm-raised p-6 rounded-3xl flex items-center space-x-4">
                       <Loader2 size={24} className="animate-spin text-emeraldArch" />
                       <span className="text-xs font-black uppercase tracking-widest">Rendering PDF Layout...</span>
                    </div>
                 </div>
               )}
            </div>
          </div>

          <div id="pdf-section-entries" className="space-y-8 pb-32">
            {meeting.rows.map((row, idx) => (
              <div key={row.id} className="grid grid-cols-12 gap-8 group">
                <div className="col-span-1 flex flex-col items-center">
                   <div className="nm-raised w-10 h-10 rounded-xl flex items-center justify-center text-[10px] font-black text-emeraldArch">{idx + 1}</div>
                   <div className="w-px flex-1 nm-inset mt-4 mb-4" />
                </div>
                <div className="col-span-7">
                   <div className="nm-inset rounded-3xl p-6 flex flex-col min-h-[160px] relative">
                      <textarea 
                        value={row.discussion}
                        onChange={(e) => updateRow(row.id, 'discussion', e.target.value)}
                        onPaste={(e) => handlePasteImage(e, row.id)}
                        placeholder="Session notes... (Paste images Ctrl+V)"
                        className="w-full bg-transparent resize-none focus:outline-none text-sm leading-relaxed font-medium flex-1 mb-4 scrollbar-hide"
                      />
                      
                      <div className="flex items-center space-x-4 overflow-x-auto pb-2 scrollbar-hide">
                          {row.images.map(img => (
                             <div key={img.id} className="relative nm-raised p-1 rounded-xl flex-shrink-0 group/img">
                                  <img src={img.url} className="w-20 h-20 object-cover rounded-lg" />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity rounded-lg flex items-center justify-center space-x-2">
                                      <button onClick={() => setEditingMarkup({ rowId: row.id, imageId: img.id, url: img.url, markup: img.markup })} className="text-white hover:text-emeraldArch transition-colors"><Edit3 size={12} /></button>
                                      <button onClick={() => removeImage(row.id, img.id)} className="text-white hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
                                  </div>
                             </div>
                          ))}
                          <button 
                              onClick={() => triggerUpload(row.id)}
                              className="w-20 h-20 nm-btn rounded-xl flex flex-col items-center justify-center text-emeraldArch/50 hover:text-emeraldArch transition-all border-2 border-dashed border-emeraldArch/20 hover:border-emeraldArch/40 flex-shrink-0"
                          >
                              <Plus size={16} />
                              <span className="text-[8px] font-black uppercase mt-1 tracking-tighter">Attach</span>
                          </button>
                      </div>
                   </div>
                </div>
                <div className="col-span-4">
                   <div className="nm-inset rounded-3xl p-6 h-full border-l-4 border-emeraldArch/20">
                      <textarea 
                        value={row.followUp}
                        onChange={(e) => updateRow(row.id, 'followUp', e.target.value)}
                        placeholder="Follow-up actions..."
                        className="w-full h-full bg-transparent resize-none focus:outline-none text-xs italic text-emeraldArch font-medium"
                      />
                   </div>
                </div>
              </div>
            ))}
            
            {meeting.rows.length === 0 && (
              <div className="nm-raised rounded-[40px] p-20 text-center">
                  <p className="text-textMuted font-black uppercase tracking-[0.2em] text-xs">No entries in this log</p>
                  <button onClick={addRow} className="mt-8 nm-emerald px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest">Initialize First Point</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="absolute bottom-10 right-10">
        <button onClick={addRow} className="nm-emerald w-16 h-16 rounded-[24px] flex items-center justify-center transition-transform hover:scale-110 active:scale-90 shadow-2xl">
            <Plus size={32} />
        </button>
      </div>

      {/* Export Modal */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="nm-raised w-full max-w-md rounded-[40px] p-8 space-y-8">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black uppercase tracking-tight">Export Preferences</h3>
              <button onClick={() => setIsExportModalOpen(false)} className="nm-btn p-2 rounded-xl text-textMuted"><X size={18} /></button>
            </div>
            
            <p className="text-xs font-bold text-textMuted leading-relaxed">
              Select the components to include in the architectural session report. High-fidelity rendering will be used for drawings.
            </p>
            
            <div className="space-y-4">
               <button 
                onClick={() => setExportOptions(prev => ({ ...prev, attendees: !prev.attendees }))}
                className={`w-full flex items-center justify-between p-5 rounded-2xl transition-all ${exportOptions.attendees ? 'nm-inset border border-emeraldArch/30' : 'nm-btn'}`}
               >
                 <div className="flex items-center space-x-4">
                    <div className={`p-2 rounded-xl ${exportOptions.attendees ? 'bg-emeraldArch/10 text-emeraldArch' : 'text-textMuted'}`}><Users size={18} /></div>
                    <span className="text-xs font-black uppercase tracking-widest">Stakeholders & Attendees</span>
                 </div>
                 {exportOptions.attendees ? <CheckSquare size={18} className="text-emeraldArch" /> : <Square size={18} className="text-textMuted" />}
               </button>

               <button 
                onClick={() => setExportOptions(prev => ({ ...prev, whiteboard: !prev.whiteboard }))}
                className={`w-full flex items-center justify-between p-5 rounded-2xl transition-all ${exportOptions.whiteboard ? 'nm-inset border border-emeraldArch/30' : 'nm-btn'}`}
               >
                 <div className="flex items-center space-x-4">
                    <div className={`p-2 rounded-xl ${exportOptions.whiteboard ? 'bg-emeraldArch/10 text-emeraldArch' : 'text-textMuted'}`}><PenTool size={18} /></div>
                    <span className="text-xs font-black uppercase tracking-widest">Project Scratchpad</span>
                 </div>
                 {exportOptions.whiteboard ? <CheckSquare size={18} className="text-emeraldArch" /> : <Square size={18} className="text-textMuted" />}
               </button>

               <button 
                onClick={() => setExportOptions(prev => ({ ...prev, entries: !prev.entries }))}
                className={`w-full flex items-center justify-between p-5 rounded-2xl transition-all ${exportOptions.entries ? 'nm-inset border border-emeraldArch/30' : 'nm-btn'}`}
               >
                 <div className="flex items-center space-x-4">
                    <div className={`p-2 rounded-xl ${exportOptions.entries ? 'bg-emeraldArch/10 text-emeraldArch' : 'text-textMuted'}`}><FileText size={18} /></div>
                    <span className="text-xs font-black uppercase tracking-widest">Session Log Entries</span>
                 </div>
                 {exportOptions.entries ? <CheckSquare size={18} className="text-emeraldArch" /> : <Square size={18} className="text-textMuted" />}
               </button>
            </div>
            
            <button 
                disabled={isGeneratingPdf || (!exportOptions.attendees && !exportOptions.whiteboard && !exportOptions.entries)}
                onClick={handleExportPdf}
                className="w-full nm-emerald py-5 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center space-x-3 disabled:opacity-50"
            >
              {isGeneratingPdf ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
              <span>{isGeneratingPdf ? 'Compiling Report...' : 'Generate Simplified PDF'}</span>
            </button>
          </div>
        </div>
      )}

      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*,application/pdf" 
        onChange={(e) => { 
            const file = e.target.files?.[0];
            if (file && activeRowId.current) {
                handleFileUpload(file, 'row', activeRowId.current);
                e.target.value = ''; // Reset input
            }
        }} 
      />

      <input 
        type="file" 
        ref={whiteboardImageInputRef} 
        className="hidden" 
        accept="image/*,application/pdf" 
        onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
                handleFileUpload(file, 'whiteboard');
                e.target.value = ''; // Reset input
            }
        }} 
      />

      {editingMarkup && (
        <DrawingCanvas 
            imageUrl={editingMarkup.url} 
            initialMarkup={editingMarkup.markup} 
            onCancel={() => setEditingMarkup(null)} 
            onSave={(markup) => {
                const { rowId, imageId } = editingMarkup;
                const updatedRows = meeting.rows.map(row => {
                  if (row.id === rowId) {
                    return {
                      ...row,
                      images: row.images.map(img => img.id === imageId ? { ...img, markup } : img)
                    };
                  }
                  return row;
                });
                onUpdate({ ...meeting, rows: updatedRows });
                setEditingMarkup(null);
            }} 
        />
      )}
    </div>
  );
};

export default MeetingView;
