import React, { useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, PanResponder, Platform } from 'react-native';
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
  const containerRef = useRef<View>(null);

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

  const getRelativePosition = (evt: any) => {
    // For web, use pageX/pageY and calculate relative to container
    if (Platform.OS === 'web') {
      const nativeEvent = evt.nativeEvent;
      // Use pageX/pageY for web
      const x = nativeEvent.pageX || nativeEvent.clientX || 0;
      const y = nativeEvent.pageY || nativeEvent.clientY || 0;
      
      // Get container position
      if (containerRef.current) {
        // @ts-ignore - web-specific
        const rect = containerRef.current.getBoundingClientRect?.();
        if (rect) {
          return {
            x: x - rect.left,
            y: y - rect.top
          };
        }
      }
      return { x, y };
    } else {
      // For native, use locationX/locationY
      const { locationX, locationY } = evt.nativeEvent;
      return { x: locationX || 0, y: locationY || 0 };
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => canDraw,
      onMoveShouldSetPanResponder: () => canDraw,
      onPanResponderGrant: (evt) => {
        if (!canDraw) return;
        
        const pos = getRelativePosition(evt);
        const newPoint = { x: pos.x, y: pos.y };
        currentStrokeRef.current = [newPoint];
        setCurrentStroke([newPoint]);
      },
      onPanResponderMove: (evt) => {
        if (!canDraw) return;
        
        const pos = getRelativePosition(evt);
        const newPoint = { x: pos.x, y: pos.y };
        currentStrokeRef.current = [...currentStrokeRef.current, newPoint];
        setCurrentStroke([...currentStrokeRef.current]);
      },
      onPanResponderRelease: () => {
        if (!canDraw || currentStrokeRef.current.length === 0) return;
        
        const newStroke: Stroke = {
          points: currentStrokeRef.current,
          color: '#000000',
          width: 3,
        };
        
        setStrokes((prev) => [...prev, newStroke]);
        onStrokeSent(newStroke);
        
        setCurrentStroke([]);
        currentStrokeRef.current = [];
      },
    })
  ).current;

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
      ref={containerRef}
      style={styles.container} 
      {...panResponder.panHandlers}
    >
      <Svg width="100%" height="100%" style={styles.svg}>
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
    cursor: 'crosshair',
  },
  svg: {
    backgroundColor: '#ffffff',
  },
});

export default Canvas;
