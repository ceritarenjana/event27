"use client"
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import JsBarcode from 'jsbarcode'
import { Rnd } from 'react-rnd'
import { useMediaQuery } from 'react-responsive'

export default function GenerateOfflineTicketPage() {
  const params = useParams<{ id: string }>()
  const eventId = params?.id
  const [template, setTemplate] = useState<File|null>(null)
  const [previewUrl, setPreviewUrl] = useState<string|null>(null)
  const [barcode, setBarcode] = useState({ x: 0, y: 0, width: 263, height: 263 })
  const [tickets, setTickets] = useState<any[]>([])
  const [generating, setGenerating] = useState(false)
  const [pdfUrl, setPdfUrl] = useState<string|null>(null)
  const [error, setError] = useState<string|null>(null)
  const [templateNaturalSize, setTemplateNaturalSize] = useState<{width:number, height:number}|null>(null)
  const [imgSize, setImgSize] = useState<{width:number, height:number}>({ width: 700, height: 198 })

  // Fetch tickets for this event (bukan peserta)
  useEffect(() => {
    async function fetchTickets() {
      if (!eventId) return
      try {
        const res = await fetch(`/api/events/${eventId}/tickets`)
        if (!res.ok) throw new Error('Failed to fetch tickets')
        const data = await res.json()
        setTickets(data.tickets || [])
      } catch (err) {
        setError('Gagal mengambil data tiket')
      }
    }
    fetchTickets()
  }, [eventId])

  const handleTemplateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setTemplate(file)
      setPreviewUrl(URL.createObjectURL(file))
      // Ambil dimensi asli gambar
      const img = new window.Image()
      img.src = URL.createObjectURL(file)
      img.onload = () => setTemplateNaturalSize({ width: img.naturalWidth, height: img.naturalHeight })
    }
  }

  const handleBarcodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBarcode({ ...barcode, [e.target.name]: Number(e.target.value) })
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setPdfUrl(null)
    setError(null)
    try {
      if (!template || tickets.length === 0) throw new Error('Tidak ada tiket untuk event ini!')
      if (!templateNaturalSize) throw new Error('Dimensi asli template belum tersedia!')
      // Konversi pixel preview ke pixel asli
      const scaleX = templateNaturalSize.width / imgSize.width
      const scaleY = templateNaturalSize.height / imgSize.height
      const barcodeX = Math.round(barcode.x * scaleX)
      const barcodeY = Math.round(barcode.y * scaleY)
      const barcodeWidth = Math.round(barcode.width * scaleX)
      const barcodeHeight = Math.round(barcode.height * scaleY)
      const formData = new FormData()
      formData.append('template', template)
      formData.append('barcode_x', String(barcodeX))
      formData.append('barcode_y', String(barcodeY))
      formData.append('barcode_width', String(barcodeWidth))
      formData.append('barcode_height', String(barcodeHeight))
      formData.append('participants', JSON.stringify(tickets.map(t => ({ name: t.token, token: t.token }))))
      const res = await fetch(`/api/events/${eventId}/generate-offline-tickets`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new Error('Gagal generate PDF')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      setPdfUrl(url)
      showToast('PDF berhasil dibuat!', 'success')
    } catch (err: any) {
      setError(err.message || 'Terjadi error')
      showToast('Gagal generate PDF', 'error')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 bg-[#181828] min-h-screen">
      <h2 className="text-2xl font-bold mb-6 text-white">Generate Ticket Offline</h2>
      {error && <div className="mb-4 text-red-400 font-semibold">{error}</div>}
      {templateNaturalSize && (
        <div className="mb-2 text-green-300 text-xs">Dimensi asli template: {templateNaturalSize.width}px x {templateNaturalSize.height}px</div>
      )}
      {/* Barcode Overlay Editor */}
      {template && previewUrl && (
        <BarcodeOverlayEditor templateUrl={previewUrl} barcode={barcode} setBarcode={setBarcode} setImgSize={setImgSize} imgSize={imgSize} templateNaturalSize={templateNaturalSize} />
      )}
      <div className="bg-[#23233a] rounded-xl shadow p-6 mb-8 border border-white/10">
        <label className="block font-semibold mb-2 text-white">Upload Template Tiket (21cm x 5.94cm)</label>
        <input type="file" accept="image/*" onChange={handleTemplateChange} className="mb-4 text-white" />
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-white">Barcode X</label>
            <input type="number" name="x" value={barcode.x} onChange={handleBarcodeChange} className="w-full border rounded px-2 py-1 bg-[#181828] text-white border-white/20" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-white">Barcode Y</label>
            <input type="number" name="y" value={barcode.y} onChange={handleBarcodeChange} className="w-full border rounded px-2 py-1 bg-[#181828] text-white border-white/20" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-white">Barcode Width</label>
            <input type="number" name="width" value={barcode.width} onChange={handleBarcodeChange} className="w-full border rounded px-2 py-1 bg-[#181828] text-white border-white/20" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-white">Barcode Height</label>
            <input type="number" name="height" value={barcode.height} onChange={handleBarcodeChange} className="w-full border rounded px-2 py-1 bg-[#181828] text-white border-white/20" />
          </div>
        </div>
      </div>
      {/* Info jumlah tiket */}
      {tickets.length > 0 && (
        <div className="mb-4 text-white font-semibold text-lg">Akan digenerate sebanyak {tickets.length} tiket (sesuai kuota event)</div>
      )}
      <button onClick={handleGenerate} disabled={generating || !template || tickets.length === 0} className="px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold text-lg shadow disabled:opacity-50 disabled:cursor-not-allowed">
        {generating ? 'Generating...' : 'Generate & Download PDF'}
      </button>
      {pdfUrl && (
        <div className="mt-6">
          <a href={pdfUrl} download className="inline-block px-5 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold shadow">Download PDF</a>
        </div>
      )}
      {/* Preview A4 tetap di bawah */}
      {template && previewUrl && tickets.length > 0 && (
        <TicketPreview templateUrl={previewUrl} barcode={barcode} participants={tickets.slice(0,10)} />
      )}
    </div>
  )
}

function showToast(msg: string, type: 'success' | 'error' = 'success') {
  if (typeof window !== 'undefined') {
    const el = document.createElement('div')
    el.textContent = msg
    el.className = `fixed top-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg z-[9999] text-white font-bold text-lg ${type === 'success' ? 'bg-green-600' : 'bg-red-600'}`
    document.body.appendChild(el)
    setTimeout(() => el.remove(), 2500)
  }
}

function BarcodeOverlayEditor({ templateUrl, barcode, setBarcode, setImgSize, imgSize, templateNaturalSize }: { templateUrl: string, barcode: any, setBarcode: (b: any) => void, setImgSize: (s: {width:number, height:number}) => void, imgSize: {width:number, height:number}, templateNaturalSize: {width:number, height:number}|null }) {
  const [warning, setWarning] = useState<string|null>(null)
  const [lockArea, setLockArea] = useState<{x:number,y:number,width:number,height:number}|null>(null)
  const [lockEnabled, setLockEnabled] = useState(true)
  const [editLock, setEditLock] = useState(false)
  const [dragLock, setDragLock] = useState<{x:number,y:number,width:number,height:number}|null>(null)
  const boxColor = 'rgba(255,255,255,0.7)'
  const isMobile = useMediaQuery({ maxWidth: 600 })
  const gridSize = 5
  // Snap-to-grid
  const snap = (v: number) => Math.round(v / gridSize) * gridSize
  // Dummy barcode preview
  const barcodeRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (barcodeRef.current) {
      JsBarcode(barcodeRef.current, 'SAMPLE123', {
        format: 'CODE128',
        width: Math.max(1, barcode.width / 100),
        height: Math.max(10, barcode.height / 3),
        displayValue: false,
        margin: 0,
      })
    }
  }, [barcode.width, barcode.height])
  // Area lock default adaptif (maks 60% tinggi template)
  useEffect(() => {
    if (!lockArea && imgSize.width && imgSize.height) {
      const maxH = Math.round(imgSize.height * 0.6)
      setLockArea({
        x: Math.round(imgSize.width * 0.7),
        y: Math.round(imgSize.height * 0.2),
        width: Math.round(imgSize.width * 0.3),
        height: maxH
      })
    }
  }, [imgSize.width, imgSize.height, lockArea])
  // Reset & Center (improvisasi: scale 80% area lock)
  const handleReset = () => {
    if (lockArea) {
      setBarcode({
        x: lockArea.x + Math.round(lockArea.width * 0.1),
        y: lockArea.y + Math.round(lockArea.height * 0.1),
        width: Math.round(lockArea.width * 0.8),
        height: Math.round(lockArea.height * 0.8)
      })
    } else {
      setBarcode({ x: 20, y: 20, width: 120, height: 60 })
    }
  }
  const handleCenter = () => {
    if (lockArea) {
      setBarcode({
        x: lockArea.x + Math.round(lockArea.width * 0.1),
        y: lockArea.y + Math.round(lockArea.height * 0.1),
        width: Math.round(lockArea.width * 0.8),
        height: Math.round(lockArea.height * 0.8)
      })
    }
  }
  // Reset area QR ke default
  const handleResetLock = () => setLockArea({ x: Math.round(imgSize.width * 0.7), y: Math.round(imgSize.height * 0.3), width: Math.round(imgSize.width * 0.3), height: Math.round(imgSize.height * 0.4) })
  // Garis grid
  const gridLines = []
  for (let x = gridSize; x < imgSize.width; x += gridSize) gridLines.push(<div key={'gx'+x} className="absolute top-0 left-0 w-[1px] h-full bg-white/10" style={{ left: x }} />)
  for (let y = gridSize; y < imgSize.height; y += gridSize) gridLines.push(<div key={'gy'+y} className="absolute left-0 top-0 h-[1px] w-full bg-white/10" style={{ top: y }} />)
  // Validasi otomatis agar barcode tidak keluar batas/lock area dan scaling otomatis
  useEffect(() => {
    if (!lockArea) return
    let { x, y, width, height } = barcode
    let warn = null
    // Snap ke area lock
    if (x < lockArea.x) x = lockArea.x
    if (y < lockArea.y) y = lockArea.y
    if (x + width > lockArea.x + lockArea.width) width = lockArea.x + lockArea.width - x
    if (y + height > lockArea.y + lockArea.height) height = lockArea.y + lockArea.height - y
    // Scaling otomatis: min 30px, max 80% area lock
    const maxW = Math.round(lockArea.width * 0.8)
    const maxH = Math.round(lockArea.height * 0.8)
    if (width < 30) width = 30
    if (height < 30) height = 30
    if (width > maxW) { width = maxW; warn = 'Barcode terlalu lebar, otomatis diskalakan.' }
    if (height > maxH) { height = maxH; warn = 'Barcode terlalu tinggi, otomatis diskalakan.' }
    if (x !== barcode.x || y !== barcode.y || width !== barcode.width || height !== barcode.height) {
      setBarcode({ x, y, width, height })
    }
    setWarning(warn)
  }, [barcode, lockArea])

  // Drag & resize area QR (lockArea)
  const handleEditLock = () => {
    setEditLock(true)
    setDragLock(lockArea)
  }
  const handleSaveLock = () => {
    if (dragLock) setLockArea(dragLock)
    setEditLock(false)
  }
  const handleCancelLock = () => {
    setEditLock(false)
    setDragLock(null)
  }

  return (
    <div className="relative flex flex-col items-center mb-8">
      <div className="flex gap-2 mb-2 flex-wrap items-center">
        <button onClick={handleReset} className="px-3 py-1 rounded bg-white/20 text-white font-semibold shadow hover:bg-white/40 transition">Reset Barcode</button>
        <button onClick={handleCenter} className="px-3 py-1 rounded bg-white/20 text-white font-semibold shadow hover:bg-white/40 transition">Center Barcode</button>
        <button onClick={handleEditLock} className="px-3 py-1 rounded bg-yellow-400 text-black font-semibold shadow hover:bg-yellow-500 transition" title="Atur area QR">Atur Area QR</button>
        <button onClick={handleResetLock} className="px-3 py-1 rounded bg-yellow-200 text-black font-semibold shadow hover:bg-yellow-300 transition" title="Reset area QR ke default">Reset Area QR</button>
        <label className="flex items-center gap-1 ml-4 text-white text-xs">
          <input type="checkbox" checked={lockEnabled} onChange={e => setLockEnabled(e.target.checked)} /> Lock area QR
        </label>
      </div>
      <div className="text-sm text-white mb-2">Atur posisi & ukuran barcode (drag & resize box putih di atas template, hanya di area kuning)</div>
      {lockEnabled && lockArea && <div className="mb-2 text-yellow-300 text-xs">Barcode hanya bisa di area kotak QR (SCAN ME!)</div>}
      {warning && <div className="mb-2 text-red-400 font-semibold animate-pulse">{warning}</div>}
      <div className="relative" style={{ width: imgSize.width, height: imgSize.height }}>
        <img
          src={templateUrl}
          alt="Template Preview"
          className="rounded-lg shadow border border-white"
          style={{ width: imgSize.width, height: imgSize.height, objectFit: 'cover' }}
          onLoad={e => {
            const img = e.currentTarget
            setImgSize({ width: img.naturalWidth > 700 ? 700 : img.naturalWidth, height: img.naturalHeight * (img.naturalWidth > 700 ? 700 / img.naturalWidth : 1) })
          }}
        />
        {/* Overlay area lock QR, selalu di atas template */}
        {lockEnabled && lockArea && !editLock && (
          <div style={{
            position: 'absolute',
            left: lockArea.x,
            top: lockArea.y,
            width: lockArea.width,
            height: lockArea.height,
            background: 'rgba(255,255,0,0.15)',
            border: '2px dashed #FFD600',
            zIndex: 5,
            pointerEvents: 'none',
            borderRadius: 12,
            transition: 'all 0.2s'
          }} title="Area QR (SCAN ME!)" />
        )}
        {/* Drag & resize area lock QR */}
        {editLock && dragLock && (
          <Rnd
            bounds="parent"
            size={{ width: dragLock.width, height: dragLock.height }}
            position={{ x: dragLock.x, y: dragLock.y }}
            onDragStop={(e, d) => setDragLock({ ...dragLock, x: snap(d.x), y: snap(d.y) })}
            onResizeStop={(e, dir, ref, delta, pos) => setDragLock({ ...dragLock, width: snap(parseInt(ref.style.width)), height: snap(parseInt(ref.style.height)), x: snap(pos.x), y: snap(pos.y) })}
            minWidth={50}
            minHeight={50}
            style={{ border: '2px solid #FFD600', background: 'rgba(255,255,0,0.18)', zIndex: 20, borderRadius: 12, boxShadow: '0 0 8px #FFD600', transition: 'box-shadow 0.2s' }}
          >
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
              <span className="text-xs font-bold text-yellow-900 bg-yellow-200/80 px-2 py-1 rounded shadow">Area QR</span>
            </div>
          </Rnd>
        )}
        {/* Garis grid */}
        {gridLines}
        {/* Barcode box hanya bisa di area lock, selalu overlay di atas template */}
        <Rnd
          bounds="parent"
          size={{ width: barcode.width, height: barcode.height }}
          position={{ x: barcode.x, y: barcode.y }}
          onDragStop={(e, d) => {
            let x = snap(d.x)
            let y = snap(d.y)
            if (lockEnabled && lockArea) {
              if (x < lockArea.x) x = lockArea.x
              if (y < lockArea.y) y = lockArea.y
              if (x + barcode.width > lockArea.x + lockArea.width) x = lockArea.x + lockArea.width - barcode.width
              if (y + barcode.height > lockArea.y + lockArea.height) y = lockArea.y + lockArea.height - barcode.height
            }
            setBarcode({ ...barcode, x, y })
          }}
          onResizeStop={(e, dir, ref, delta, pos) => {
            let width = snap(parseInt(ref.style.width))
            let height = snap(parseInt(ref.style.height))
            let x = snap(pos.x)
            let y = snap(pos.y)
            if (lockEnabled && lockArea) {
              if (x < lockArea.x) x = lockArea.x
              if (y < lockArea.y) y = lockArea.y
              if (x + width > lockArea.x + lockArea.width) width = lockArea.x + lockArea.width - x
              if (y + height > lockArea.y + lockArea.height) height = lockArea.y + lockArea.height - y
            }
            setBarcode({ ...barcode, width, height, x, y })
          }}
          minWidth={isMobile ? 40 : 30}
          minHeight={isMobile ? 40 : 30}
          style={{ border: '2px solid #fff', background: boxColor, zIndex: 10, borderRadius: 8, boxShadow: '0 0 8px #fff', transition: 'box-shadow 0.2s' }}
          disableDragging={editLock}
          enableResizing={!editLock}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <canvas ref={barcodeRef} width={barcode.width-8} height={barcode.height-8} style={{ maxWidth: '90%', maxHeight: '90%' }} />
          </div>
          <div className="text-xs text-black font-bold px-2 py-1 bg-white/80 rounded absolute left-1 top-1 z-20 shadow">Barcode</div>
        </Rnd>
        {/* Tombol simpan/cancel area QR */}
        {editLock && (
          <div className="absolute left-1/2 -translate-x-1/2 top-2 z-30 flex gap-2 animate-fade-in">
            <button onClick={handleSaveLock} className="px-3 py-1 rounded bg-green-500 text-white font-semibold shadow hover:bg-green-600 transition">Simpan Area QR</button>
            <button onClick={handleCancelLock} className="px-3 py-1 rounded bg-gray-300 text-gray-800 font-semibold shadow hover:bg-gray-400 transition">Batal</button>
          </div>
        )}
      </div>
      <div className="flex gap-4 mt-2 flex-wrap">
        <div className="text-xs text-white" title="Jarak dari kiri template (px)">X: {barcode.x}</div>
        <div className="text-xs text-white" title="Jarak dari atas template (px)">Y: {barcode.y}</div>
        <div className="text-xs text-white" title="Lebar barcode (px)">W: {barcode.width}</div>
        <div className="text-xs text-white" title="Tinggi barcode (px)">H: {barcode.height}</div>
        <div className="text-xs text-white" title="Ukuran template (px/cm)">Template: {imgSize.width}px x {imgSize.height}px (~21cm x 5.94cm)</div>
      </div>
      <div className="mt-2 text-xs text-gray-300">Tips: Klik "Atur Area QR" lalu drag area kuning di template sesuai kotak QR pada desain. Barcode hanya bisa diletakkan di area tersebut.</div>
    </div>
  )
}

function TicketPreview({ templateUrl, barcode, participants }: { templateUrl: string, barcode: any, participants: any[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Render preview setiap ada perubahan
  useEffect(() => {
    if (!templateUrl || participants.length === 0) return
    const img = new window.Image()
    img.src = templateUrl
    img.onload = () => {
      const PAGE_W = 595 // A4 width pt (scaled)
      const PAGE_H = 842 // A4 height pt (scaled)
      const TICKET_W = 290 // 2480/2 scaled
      const TICKET_H = 135 // 702 scaled
      const COLS = 2
      const ROWS = 5
      const MARGIN_X = 7
      const MARGIN_Y = 7
      const ctx = canvasRef.current?.getContext('2d')
      if (!ctx || !canvasRef.current) return
      ctx.clearRect(0, 0, PAGE_W, PAGE_H)
      let idx = 0
      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          if (idx >= participants.length) break
          const x = col * (TICKET_W + MARGIN_X) + MARGIN_X
          const y = row * (TICKET_H + MARGIN_Y) + MARGIN_Y
          ctx.drawImage(img, x, y, TICKET_W, TICKET_H)
          // Barcode
          const barcodeCanvas = document.createElement('canvas')
          JsBarcode(barcodeCanvas, participants[idx].token, {
            format: 'CODE128',
            width: barcode.width / 20,
            height: barcode.height / 20,
            displayValue: false,
            margin: 0,
          })
          ctx.drawImage(
            barcodeCanvas,
            x + barcode.x / 20,
            y + barcode.y / 20,
            barcode.width / 20,
            barcode.height / 20
          )
          idx++
        }
      }
    }
  }, [templateUrl, barcode, participants])
  return (
    <div className="flex flex-col items-center mb-8">
      <div className="text-sm text-gray-500 mb-2">Preview (A4, 2 kolom x 5 baris, max 10 tiket per halaman)</div>
      <canvas ref={canvasRef} width={595} height={842} className="border shadow rounded-lg bg-white" style={{ width: '350px', height: '495px' }} />
    </div>
  )
} 