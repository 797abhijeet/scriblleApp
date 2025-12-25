import React, { forwardRef, useImperativeHandle, useRef, useState, useEffect, useCallback } from 'react';
import './Canvas.css';

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
  color: string;
  width: number;
}

interface CanvasProps {
  canDraw: boolean;
  onStrokeSent: (stroke: Stroke) => void;
  brushColor?: string;
  brushWidth?: number;
}

export interface CanvasRef {
  clear: () => void;
  drawStroke: (stroke: Stroke) => void;
  getCanvas: () => HTMLCanvasElement | null;
}

const Canvas = forwardRef<CanvasRef, CanvasProps>(({ 
  canDraw, 
  onStrokeSent, 
  brushColor = '#000000',
  brushWidth = 3 
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);
  const currentStrokeRef = useRef<Point[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const initCanvas = () => {
      const container = containerRef.current;
      if (!container) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) return;
      
      context.scale(dpr, dpr);
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.strokeStyle = brushColor;
      context.lineWidth = brushWidth;
      contextRef.current = context;
      
      // Set white background
      context.fillStyle = '#FFFFFF';
      context.fillRect(0, 0, rect.width, rect.height);
    };

    initCanvas();
    
    const resizeObserver = new ResizeObserver(() => {
      initCanvas();
    });
    
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    return () => {
      resizeObserver.disconnect();
    };
  }, [brushColor, brushWidth]);

  // Update brush properties
  useEffect(() => {
    if (contextRef.current) {
      contextRef.current.strokeStyle = brushColor;
      contextRef.current.lineWidth = brushWidth;
    }
  }, [brushColor, brushWidth]);

  const startDrawing = useCallback((x: number, y: number) => {
    if (!canDraw || !contextRef.current) return;
    
    isDrawingRef.current = true;
    lastPointRef.current = { x, y };
    currentStrokeRef.current = [{ x, y }];
    
    contextRef.current.beginPath();
    contextRef.current.moveTo(x, y);
  }, [canDraw]);

  const draw = useCallback((x: number, y: number) => {
    if (!isDrawingRef.current || !contextRef.current || !lastPointRef.current) return;
    
    contextRef.current.lineTo(x, y);
    contextRef.current.stroke();
    
    currentStrokeRef.current.push({ x, y });
    lastPointRef.current = { x, y };
  }, []);

  const stopDrawing = useCallback(() => {
    if (!isDrawingRef.current || !contextRef.current || currentStrokeRef.current.length < 2) {
      isDrawingRef.current = false;
      currentStrokeRef.current = [];
      return;
    }
    
    isDrawingRef.current = false;
    
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    
    // Normalize points to 0-1 range
    const normalizedPoints = currentStrokeRef.current.map(point => ({
      x: point.x / rect.width,
      y: point.y / rect.height
    }));
    
    onStrokeSent({
      points: normalizedPoints,
      color: brushColor,
      width: brushWidth
    });
    
    currentStrokeRef.current = [];
  }, [onStrokeSent, brushColor, brushWidth]);

  // Mouse event handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    startDrawing(x, y);
  }, [startDrawing]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    draw(x, y);
  }, [draw]);

  const handleMouseUp = useCallback(() => {
    stopDrawing();
  }, [stopDrawing]);

  // Touch event handlers
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!canDraw) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    e.preventDefault();
    startDrawing(x, y);
  }, [canDraw, startDrawing]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    e.preventDefault();
    draw(x, y);
  }, [draw]);

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    stopDrawing();
  }, [stopDrawing]);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    clear: () => {
      const canvas = canvasRef.current;
      const context = contextRef.current;
      const container = containerRef.current;
      
      if (canvas && context && container) {
        context.fillStyle = '#FFFFFF';
        context.fillRect(0, 0, container.clientWidth, container.clientHeight);
      }
    },
    
    drawStroke: (stroke: Stroke) => {
      const canvas = canvasRef.current;
      const context = contextRef.current;
      const container = containerRef.current;
      
      if (!canvas || !context || !container) return;
      
      const rect = container.getBoundingClientRect();
      
      context.save();
      context.strokeStyle = stroke.color;
      context.lineWidth = stroke.width;
      context.beginPath();
      
      stroke.points.forEach((point, index) => {
        const x = point.x * rect.width;
        const y = point.y * rect.height;
        
        if (index === 0) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
      });
      
      context.stroke();
      context.restore();
    },
    
    getCanvas: () => canvasRef.current
  }), []);

  return (
    <div ref={containerRef} className="canvas-container">
      <canvas
        ref={canvasRef}
        className="drawing-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onContextMenu={(e) => e.preventDefault()}
      />
      {!canDraw && (
        <div className="canvas-overlay">
          <div className="overlay-text">
            👀 Watching the artist draw...
          </div>
        </div>
      )}
    </div>
  );
});

Canvas.displayName = 'Canvas';

export default Canvas;