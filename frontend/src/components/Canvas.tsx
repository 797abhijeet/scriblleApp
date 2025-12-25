import { forwardRef, useImperativeHandle, useRef, useEffect, useState } from 'react'
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

const Canvas = forwardRef<CanvasRef, CanvasProps>(
  ({ canDraw, onStrokeSent }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const contextRef = useRef<CanvasRenderingContext2D | null>(null)
    const strokeRef = useRef<{ x: number; y: number }[]>([])
    const [isDrawing, setIsDrawing] = useState(false)
    const canvasSizeRef = useRef({ width: 0, height: 0 })

    /* -------------------- Canvas Setup -------------------- */
    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return

      const resizeCanvas = () => {
        const container = canvas.parentElement
        if (!container) return

        const ratio = window.devicePixelRatio || 1

        canvas.width = container.clientWidth * ratio
        canvas.height = container.clientHeight * ratio
        canvas.style.width = `${container.clientWidth}px`
        canvas.style.height = `${container.clientHeight}px`

        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
          ctx.lineCap = 'round'
          ctx.lineJoin = 'round'
          ctx.strokeStyle = '#000'
          ctx.lineWidth = 3
          contextRef.current = ctx
        }

        canvasSizeRef.current = {
          width: container.clientWidth,
          height: container.clientHeight,
        }
      }

      resizeCanvas()
      window.addEventListener('resize', resizeCanvas)

      return () => window.removeEventListener('resize', resizeCanvas)
    }, [])

    /* -------------------- Exposed Methods -------------------- */
    useImperativeHandle(ref, () => ({
      clear() {
        const canvas = canvasRef.current
        const ctx = contextRef.current
        if (canvas && ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
        }
      },

      drawStroke(stroke: Stroke) {
        const ctx = contextRef.current
        if (!ctx) return

        ctx.save()
        ctx.beginPath()
        ctx.strokeStyle = stroke.color
        ctx.lineWidth = stroke.width

        stroke.points.forEach((p, i) => {
          const x = p.x * canvasSizeRef.current.width
          const y = p.y * canvasSizeRef.current.height
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        })

        ctx.stroke()
        ctx.restore()
      },
    }))

    /* -------------------- Drawing Handlers -------------------- */
    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!canDraw) return

      const rect = canvasRef.current!.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      strokeRef.current = [{ x, y }]
      setIsDrawing(true)

      const ctx = contextRef.current
      if (ctx) {
        ctx.beginPath()
        ctx.moveTo(x, y)
      }
    }

    const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing || !canDraw) return

      const rect = canvasRef.current!.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      strokeRef.current.push({ x, y })

      const ctx = contextRef.current
      if (ctx) {
        ctx.lineTo(x, y)
        ctx.stroke()
      }
    }

    const stopDrawing = () => {
      if (!isDrawing || !canDraw) return
      setIsDrawing(false)

      const stroke = strokeRef.current
      if (stroke.length === 0) return

      const normalized = stroke.map(p => ({
        x: p.x / canvasSizeRef.current.width,
        y: p.y / canvasSizeRef.current.height,
      }))

      onStrokeSent({
        points: normalized,
        color: '#000',
        width: 3,
      })

      strokeRef.current = []
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
  }
)

Canvas.displayName = 'Canvas'
export default Canvas
