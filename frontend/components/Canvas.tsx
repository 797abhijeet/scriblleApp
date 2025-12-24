import React, { useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';

interface Stroke {
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

interface CanvasProps {
  canDraw: boolean;
  onStrokeSent: (stroke: Stroke) => void;
}

export interface CanvasRef {
  clear: () => void;
  drawStroke: (stroke: Stroke) => void;
}

const Canvas = forwardRef<CanvasRef, CanvasProps>(({ canDraw, onStrokeSent }, ref) => {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<{ x: number; y: number }[]>([]);
  const currentStrokeRef = useRef<{ x: number; y: number }[]>([]);
  const isDrawing = useRef(false);
  const svgRef = useRef<any>(null);

  useImperativeHandle(ref, () => ({
    clear: () => {
      setStrokes([]);
      setCurrentStroke([]);
      currentStrokeRef.current = [];
    },
    drawStroke: (stroke: Stroke) => {
      setStrokes((prev) => [...prev, stroke]);
    },
  }));

  const handleMouseDown = (e: any) => {
    if (!canDraw) return;
    
    isDrawing.current = true;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    currentStrokeRef.current = [{ x, y }];
    setCurrentStroke([{ x, y }]);
  };

  const handleMouseMove = (e: any) => {
    if (!canDraw || !isDrawing.current) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    currentStrokeRef.current = [...currentStrokeRef.current, { x, y }];
    setCurrentStroke([...currentStrokeRef.current]);
  };

  const handleMouseUp = () => {
    if (!canDraw || !isDrawing.current) return;
    
    isDrawing.current = false;
    
    if (currentStrokeRef.current.length > 0) {
      const newStroke: Stroke = {
        points: currentStrokeRef.current,
        color: '#000000',
        width: 3,
      };
      
      setStrokes((prev) => [...prev, newStroke]);
      onStrokeSent(newStroke);
    }
    
    setCurrentStroke([]);
    currentStrokeRef.current = [];
  };

  const handleTouchStart = (e: any) => {
    if (!canDraw) return;
    
    e.preventDefault(); // Prevent scrolling
    isDrawing.current = true;
    const touch = e.touches[0] || e.changedTouches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    currentStrokeRef.current = [{ x, y }];
    setCurrentStroke([{ x, y }]);
  };

  const handleTouchMove = (e: any) => {
    if (!canDraw || !isDrawing.current) return;
    
    e.preventDefault(); // Prevent scrolling while drawing
    const touch = e.touches[0] || e.changedTouches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    currentStrokeRef.current = [...currentStrokeRef.current, { x, y }];
    setCurrentStroke([...currentStrokeRef.current]);
  };

  const handleTouchEnd = (e: any) => {
    if (!canDraw || !isDrawing.current) return;
    
    e.preventDefault();
    isDrawing.current = false;
    
    if (currentStrokeRef.current.length > 0) {
      const newStroke: Stroke = {
        points: currentStrokeRef.current,
        color: '#000000',
        width: 3,
      };
      
      setStrokes((prev) => [...prev, newStroke]);
      onStrokeSent(newStroke);
    }
    
    setCurrentStroke([]);
    currentStrokeRef.current = [];
  };

  const pointsToPath = (points: { x: number; y: number }[]): string => {
    if (points.length === 0) return '';
    
    let path = `M ${points[0].x} ${points[0].y}`;
    
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }
    
    return path;
  };

  return (
    <View 
      style={styles.container}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
    >
      <Svg 
        width="100%" 
        height="100%" 
        style={styles.svg}
        ref={svgRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <G>
          {strokes.map((stroke, index) => (
            <Path
              key={`stroke-${index}`}
              d={pointsToPath(stroke.points)}
              stroke={stroke.color}
              strokeWidth={stroke.width}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {currentStroke.length > 0 && (
            <Path
              d={pointsToPath(currentStroke)}
              stroke="#000000"
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </G>
      </Svg>
    </View>
  );
});

Canvas.displayName = 'Canvas';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    // @ts-ignore - web-specific touch handling
    touchAction: 'none', // Prevents scrolling/zooming on touch
  },
  svg: {
    backgroundColor: '#ffffff',
    cursor: 'crosshair',
    // @ts-ignore - web-specific
    touchAction: 'none',
  },
});

export default Canvas;
