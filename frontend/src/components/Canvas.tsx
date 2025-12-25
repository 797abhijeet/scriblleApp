import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
  useState,
} from 'react'
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
        if (!ctx) return

        ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'

        contextRef.current = ctx
        canvasSizeRef.current = {
          width: container.clientWidth,
          height: container.clientHeight,
        }
      }

      resizeCanvas()
      window.addEventListener('resize', resizeCanvas)
      return () => window.removeEventListener('resize', resizeCanvas)
    }, [])

    /* -------------------- Helpers -------------------- */
    const getPos = (e: any) => {
      const rect = canvasRef.current!.getBoundingClientRect()

      if (e.touches) {
        return {
          x: e.touches[0].clientX - rect.left,
          y: e.touches[0].clientY - rect.top,
        }
      }

      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      }
    }

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

    /* -------------------- Drawing Logic -------------------- */
    const startDrawing = (e: any) => {
      if (!canDraw) return
      e.preventDefault()

      const { x, y } = getPos(e)
      strokeRef.current = [{ x, y }]
      setIsDrawing(true)

      contextRef.current?.beginPath()
      contextRef.current?.moveTo(x, y)
    }

    const draw = (e: any) => {
      if (!isDrawing || !canDraw) return
      e.preventDefault()

      const { x, y } = getPos(e)
      strokeRef.current.push({ x, y })

      contextRef.current?.lineTo(x, y)
      contextRef.current?.stroke()
    }

    const stopDrawing = (e?: any) => {
      if (!isDrawing || !canDraw) return
      e?.preventDefault()

      setIsDrawing(false)
      if (strokeRef.current.length === 0) return

      const normalized = strokeRef.current.map(p => ({
        x: p.x / canvasSizeRef.current.width,
        y: p.y / canvasSizeRef.current.height,
      }))

      // 🔥 DO NOT HARD-CODE COLOR OR WIDTH
      onStrokeSent({
        points: normalized,
        color: contextRef.current?.strokeStyle as string,
        width: contextRef.current?.lineWidth || 3,
      })

      strokeRef.current = []
    }

    return (
      <canvas
        ref={canvasRef}
        className="drawing-canvas" // ✅ SAME AS BEFORE
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />
    )
  }
)

Canvas.displayName = 'Canvas'
export default Canvas
