import { forwardRef, useImperativeHandle, useRef, useState, useEffect } from 'react'
import '../styles/Canvas.css'

interface Stroke {
  points: { x: number; y: number }[]
  color: string
  width: number
}

interface CanvasProps {
  canDraw: boolean
  onStrokeSent: (stroke: Stroke) => void
}

export interface CanvasRef {
  clear: () => void
  drawStroke: (stroke: Stroke) => void
}

const Canvas = forwardRef<CanvasRef, CanvasProps>(({ canDraw, onStrokeSent }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentStroke, setCurrentStroke] = useState<{ x: number; y: number }[]>([])
  const contextRef = useRef<CanvasRenderingContext2D | null>(null)
  const canvasSizeRef = useRef({ width: 0, height: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resizeCanvas = () => {
      const container = canvas.parentElement
      if (!container) return

      canvas.width = container.clientWidth
      canvas.height = container.clientHeight
      canvasSizeRef.current = { width: canvas.width, height: canvas.height }

      const context = canvas.getContext('2d')
      if (context) {
        context.lineCap = 'round'
        context.lineJoin = 'round'
        context.strokeStyle = '#000000'
        context.lineWidth = 3
        contextRef.current = context
      }
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    return () => {
      window.removeEventListener('resize', resizeCanvas)
    }
  }, [])

  useImperativeHandle(ref, () => ({
    clear: () => {
      const canvas = canvasRef.current
      const context = contextRef.current
      if (canvas && context) {
        context.clearRect(0, 0, canvas.width, canvas.height)
      }
    },
    drawStroke: (stroke: Stroke) => {
      const context = contextRef.current
      if (!context || !canvasSizeRef.current.width) return

      context.beginPath()
      stroke.points.forEach((point, index) => {
        const x = point.x * canvasSizeRef.current.width
        const y = point.y * canvasSizeRef.current.height
        
        if (index === 0) {
          context.moveTo(x, y)
        } else {
          context.lineTo(x, y)
        }
      })
      context.stroke()
    },
  }))

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canDraw) return

    setIsDrawing(true)
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setCurrentStroke([{ x, y }])

    const context = contextRef.current
    if (context) {
      context.beginPath()
      context.moveTo(x, y)
    }
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canDraw) return

    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setCurrentStroke((prev) => [...prev, { x, y }])

    const context = contextRef.current
    if (context) {
      context.lineTo(x, y)
      context.stroke()
    }
  }

  const stopDrawing = () => {
    if (!isDrawing || !canDraw) return

    setIsDrawing(false)

    if (currentStroke.length > 0 && canvasSizeRef.current.width > 0) {
      // Normalize coordinates
      const normalizedPoints = currentStroke.map((point) => ({
        x: point.x / canvasSizeRef.current.width,
        y: point.y / canvasSizeRef.current.height,
      }))

      onStrokeSent({
        points: normalizedPoints,
        color: '#000000',
        width: 3,
      })
    }

    setCurrentStroke([])
  }

  return (
    <canvas
      ref={canvasRef}
      className="drawing-canvas"
      onMouseDown={startDrawing}
      onMouseMove={draw}
      onMouseUp={stopDrawing}
      onMouseLeave={stopDrawing}
    />
  )
})

Canvas.displayName = 'Canvas'

export default Canvas
