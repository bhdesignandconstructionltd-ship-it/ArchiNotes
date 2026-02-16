
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MarkupPath, ToolType, ToolColor } from '../types';
import { Undo, Redo, Eraser, Highlighter, PenTool, Save, X } from 'lucide-react';

interface DrawingCanvasProps {
  imageUrl: string;
  initialMarkup: MarkupPath[];
  onSave: (markup: MarkupPath[]) => void;
  onCancel: () => void;
}

const DrawingCanvas: React.FC<DrawingCanvasProps> = ({ imageUrl, initialMarkup, onSave, onCancel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [paths, setPaths] = useState<MarkupPath[]>(initialMarkup);
  const [redoStack, setRedoStack] = useState<MarkupPath[][]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);
  const [tool, setTool] = useState<ToolType>(ToolType.MARKER);
  const [color, setColor] = useState<ToolColor>('#ef4444'); 
  const [imgSize, setImgSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
      const maxWidth = window.innerWidth * 0.8;
      const maxHeight = window.innerHeight * 0.7;
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height *= maxWidth / width;
        width = maxWidth;
      }
      if (height > maxHeight) {
        width *= maxHeight / height;
        height = maxHeight;
      }
      setImgSize({ width, height });
    };
  }, [imageUrl]);

  const drawPaths = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    paths.forEach(path => {
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

    if (currentPath.length > 0) {
      ctx.beginPath();
      ctx.strokeStyle = tool === ToolType.ERASER ? '#ffffff' : color;
      ctx.lineWidth = tool === ToolType.HIGHLIGHTER ? 20 : 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = tool === ToolType.HIGHLIGHTER ? 0.4 : 1.0;
      ctx.moveTo(currentPath[0].x, currentPath[0].y);
      currentPath.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.stroke();
    }
  }, [paths, currentPath, color, tool]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) drawPaths(ctx);
    }
  }, [drawPaths, imgSize]);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top;
    return { x, y };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const coords = getCoordinates(e);
    setCurrentPath([coords]);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const coords = getCoordinates(e);
    setCurrentPath(prev => [...prev, coords]);
  };

  const endDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    
    if (tool === ToolType.ERASER) {
        setPaths(prev => prev.filter(p => !isPathIntersecting(p.points, currentPath)));
    } else {
        const newPath: MarkupPath = {
          points: currentPath,
          color: color,
          width: tool === ToolType.HIGHLIGHTER ? 20 : 4,
          isHighlighter: tool === ToolType.HIGHLIGHTER
        };
        setPaths(prev => [...prev, newPath]);
    }
    setRedoStack([]);
    setCurrentPath([]);
  };

  const isPathIntersecting = (p1: {x:number, y:number}[], p2: {x:number, y:number}[]) => {
      for (const pt1 of p1) {
          for (const pt2 of p2) {
              const dist = Math.sqrt((pt1.x - pt2.x)**2 + (pt1.y - pt2.y)**2);
              if (dist < 15) return true;
          }
      }
      return false;
  };

  const handleUndo = () => {
    if (paths.length === 0) return;
    const last = paths[paths.length - 1];
    setRedoStack(prev => [[last], ...prev]);
    setPaths(prev => prev.slice(0, -1));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    setPaths(prev => [...prev, ...next]);
    setRedoStack(prev => prev.slice(1));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-w-[95vw] max-h-[90vh] w-full">
        {/* Toolbar */}
        <div className="bg-black border-b border-neutral-800 p-4 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <div className="flex bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-lg p-1">
              <button 
                onClick={() => { setTool(ToolType.MARKER); setColor('#3b82f6'); }}
                className={`p-2.5 rounded-lg transition-all ${tool === ToolType.MARKER && color === '#3b82f6' ? 'bg-blue-600/20 text-blue-400' : 'text-neutral-500 hover:text-white'}`}
                title="Blue"
              >
                <PenTool size={20} className="stroke-[3px]" />
              </button>
              <button 
                onClick={() => { setTool(ToolType.MARKER); setColor('#ef4444'); }}
                className={`p-2.5 rounded-lg transition-all ${tool === ToolType.MARKER && color === '#ef4444' ? 'bg-red-600/20 text-red-400' : 'text-neutral-500 hover:text-white'}`}
                title="Red"
              >
                <PenTool size={20} className="stroke-[3px]" />
              </button>
              <button 
                onClick={() => { setTool(ToolType.MARKER); setColor('#22c55e'); }}
                className={`p-2.5 rounded-lg transition-all ${tool === ToolType.MARKER && color === '#22c55e' ? 'bg-green-600/20 text-green-400' : 'text-neutral-500 hover:text-white'}`}
                title="Green"
              >
                <PenTool size={20} className="stroke-[3px]" />
              </button>
              <div className="w-px h-6 bg-neutral-800 mx-1 self-center" />
              <button 
                onClick={() => { setTool(ToolType.HIGHLIGHTER); setColor('#facc15'); }}
                className={`p-2.5 rounded-lg transition-all ${tool === ToolType.HIGHLIGHTER ? 'bg-yellow-600/20 text-yellow-400' : 'text-neutral-500 hover:text-white'}`}
                title="Highlighter"
              >
                <Highlighter size={20} className="stroke-[2.5px]" />
              </button>
              <button 
                onClick={() => setTool(ToolType.ERASER)}
                className={`p-2.5 rounded-lg transition-all ${tool === ToolType.ERASER ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-white'}`}
                title="Eraser"
              >
                <Eraser size={20} />
              </button>
            </div>

            <div className="flex bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-lg p-1">
              <button onClick={handleUndo} className="p-2.5 hover:text-emeraldArch text-neutral-500 disabled:opacity-20" disabled={paths.length === 0}>
                <Undo size={20} />
              </button>
              <button onClick={handleRedo} className="p-2.5 hover:text-emeraldArch text-neutral-500 disabled:opacity-20" disabled={redoStack.length === 0}>
                <Redo size={20} />
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button onClick={onCancel} className="px-5 py-2.5 text-neutral-400 hover:text-white font-bold transition-colors">
              Discard
            </button>
            <button 
                onClick={() => onSave(paths)}
                className="px-8 py-2.5 bg-emeraldArch text-black hover:opacity-90 rounded-xl shadow-lg font-black flex items-center space-x-2"
            >
              <Save size={20} />
              <span>Publish Sketch</span>
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div 
          ref={containerRef}
          className="relative overflow-auto bg-black flex-1 flex items-center justify-center p-12 cursor-crosshair"
        >
          <div className="relative shadow-[0_0_100px_rgba(80,200,120,0.05)] bg-neutral-900 border border-neutral-800" style={{ width: imgSize.width, height: imgSize.height }}>
            <img 
              src={imageUrl} 
              alt="Background" 
              className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none" 
            />
            <canvas
              ref={canvasRef}
              width={imgSize.width}
              height={imgSize.height}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={endDrawing}
              onMouseLeave={endDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={endDrawing}
              className="absolute inset-0 z-10"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DrawingCanvas;
