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
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null)

    const [drawing, setDrawing] = useState(false)
    const [stroke, setStroke] = useState<{ x: number; y: number }[]>([])
    const [color, setColor] = useState('#000000')

    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.lineWidth = 3
        ctxRef.current = ctx
      }
    }, [])

    useImperativeHandle(ref, () => ({
      clear() {
        const c = canvasRef.current
        const ctx = ctxRef.current
        if (c && ctx) ctx.clearRect(0, 0, c.width, c.height)
      },
      drawStroke(s: Stroke) {
        const ctx = ctxRef.current
        const c = canvasRef.current
        if (!ctx || !c) return
        ctx.strokeStyle = s.color
        ctx.beginPath()
        s.points.forEach((p, i) => {
          const x = p.x * c.width
          const y = p.y * c.height
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        })
        ctx.stroke()
      },
    }))

    const getPoint = (x: number, y: number) => {
      const rect = canvasRef.current!.getBoundingClientRect()
      return { x: x - rect.left, y: y - rect.top }
    }

    const start = (x: number, y: number) => {
      if (!canDraw) return
      setDrawing(true)
      setStroke([{ x, y }])
      const ctx = ctxRef.current
      ctx!.strokeStyle = color
      ctx!.beginPath()
      ctx!.moveTo(x, y)
    }

    const move = (x: number, y: number) => {
      if (!drawing) return
      setStroke((p) => [...p, { x, y }])
      ctxRef.current!.lineTo(x, y)
      ctxRef.current!.stroke()
    }

    const end = () => {
      if (!drawing) return
      setDrawing(false)

      const c = canvasRef.current!
      onStrokeSent({
        points: stroke.map((p) => ({
          x: p.x / c.width,
          y: p.y / c.height,
        })),
        color,
        width: 3,
      })
      setStroke([])
    }

    return (
      <div className="relative w-full h-full">
        {canDraw && (
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="absolute top-2 left-2 z-10 w-8 h-8"
          />
        )}

        <canvas
          ref={canvasRef}
          className="w-full h-full bg-white rounded-xl"
          onMouseDown={(e) => start(e.clientX, e.clientY)}
          onMouseMove={(e) => move(e.clientX, e.clientY)}
          onMouseUp={end}
          onMouseLeave={end}
        />
      </div>
    )
  }
)

Canvas.displayName = 'Canvas'
export default Canvas
