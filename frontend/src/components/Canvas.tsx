import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useEffect,
} from 'react'

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

    const [isDrawing, setIsDrawing] = useState(false)
    const [currentStroke, setCurrentStroke] = useState<
      { x: number; y: number }[]
    >([])

    const canvasSizeRef = useRef({ width: 0, height: 0 })

    /* ======================
       Setup + Resize
    ====================== */
    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return

      const resizeCanvas = () => {
        const container = canvas.parentElement
        if (!container) return

        canvas.width = container.clientWidth
        canvas.height = container.clientHeight

        canvasSizeRef.current = {
          width: canvas.width,
          height: canvas.height,
        }

        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.lineCap = 'round'
          ctx.lineJoin = 'round'
          ctx.strokeStyle = '#000000'
          ctx.lineWidth = 3
          contextRef.current = ctx
        }
      }

      resizeCanvas()
      window.addEventListener('resize', resizeCanvas)

      return () => window.removeEventListener('resize', resizeCanvas)
    }, [])

    /* ======================
       Exposed Methods
    ====================== */
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
        if (!ctx || !canvasSizeRef.current.width) return

        ctx.beginPath()
        stroke.points.forEach((p, i) => {
          const x = p.x * canvasSizeRef.current.width
          const y = p.y * canvasSizeRef.current.height
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        })
        ctx.stroke()
      },
    }))

    /* ======================
       Helpers
    ====================== */
    const getPoint = (
      clientX: number,
      clientY: number
    ): { x: number; y: number } | null => {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return null

      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
      }
    }

    const start = (x: number, y: number) => {
      if (!canDraw) return
      setIsDrawing(true)
      setCurrentStroke([{ x, y }])

      const ctx = contextRef.current
      ctx?.beginPath()
      ctx?.moveTo(x, y)
    }

    const move = (x: number, y: number) => {
      if (!isDrawing || !canDraw) return

      setCurrentStroke((prev) => [...prev, { x, y }])
      const ctx = contextRef.current
      ctx?.lineTo(x, y)
      ctx?.stroke()
    }

    const end = () => {
      if (!isDrawing || !canDraw) return
      setIsDrawing(false)

      if (currentStroke.length > 0) {
        const { width, height } = canvasSizeRef.current

        const normalized = currentStroke.map((p) => ({
          x: p.x / width,
          y: p.y / height,
        }))

        onStrokeSent({
          points: normalized,
          color: '#000000',
          width: 3,
        })
      }

      setCurrentStroke([])
    }

    /* ======================
       Mouse Events
    ====================== */
    const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
      const p = getPoint(e.clientX, e.clientY)
      if (p) start(p.x, p.y)
    }

    const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
      const p = getPoint(e.clientX, e.clientY)
      if (p) move(p.x, p.y)
    }

    /* ======================
       Touch Events (Mobile)
    ====================== */
    const onTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      const touch = e.touches[0]
      const p = getPoint(touch.clientX, touch.clientY)
      if (p) start(p.x, p.y)
    }

    const onTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      const touch = e.touches[0]
      const p = getPoint(touch.clientX, touch.clientY)
      if (p) move(p.x, p.y)
    }

    const onTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      end()
    }

    return (
      <canvas
        ref={canvasRef}
        className="w-full h-full touch-none bg-white rounded-lg shadow-md"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      />
    )
  }
)

Canvas.displayName = 'Canvas'
export default Canvas