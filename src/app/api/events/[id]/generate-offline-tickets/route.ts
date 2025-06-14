import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import PDFDocument from 'pdfkit'
import bwipjs from 'bwip-js'

function isImageFile(file: File) {
  return file && (file.type === 'image/png' || file.type === 'image/jpeg' || file.name?.endsWith('.png') || file.name?.endsWith('.jpg') || file.name?.endsWith('.jpeg'))
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const formData = await req.formData()
    const templateFile = formData.get('template')
    const barcodeX = Number(formData.get('barcode_x'))
    const barcodeY = Number(formData.get('barcode_y'))
    const barcodeWidth = Number(formData.get('barcode_width'))
    const barcodeHeight = Number(formData.get('barcode_height'))
    const participants = JSON.parse(formData.get('participants') as string) as { name: string, token: string }[]

    // Type guard agar templateFile adalah File
    if (typeof templateFile !== 'object' || typeof (templateFile as any).arrayBuffer !== 'function' || typeof (templateFile as any).type !== 'string') {
      return NextResponse.json({ error: 'File template tidak valid (bukan File/Blob)' }, { status: 400 })
    }
    // Cast aman
    const file = templateFile as File
    // Logging untuk debug
    console.log('file:', file)
    console.log('file.type:', file.type)
    console.log('file.name:', file.name)
    if (!isImageFile(file)) {
      return NextResponse.json({ error: 'File template harus PNG atau JPG' }, { status: 400 })
    }
    if (barcodeWidth < 30 || barcodeHeight < 30) {
      return NextResponse.json({ error: 'Ukuran barcode terlalu kecil (min 30x30 px)' }, { status: 400 })
    }
    if (barcodeWidth > 2000 || barcodeHeight > 2000) {
      return NextResponse.json({ error: 'Ukuran barcode terlalu besar' }, { status: 400 })
    }
    if (participants.length > 2000) {
      return NextResponse.json({ error: 'Terlalu banyak tiket, generate maksimal 2000 per batch' }, { status: 400 })
    }
    let templateBuffer = Buffer.from(new Uint8Array(await file.arrayBuffer())) as Buffer
    // Jika JPG, konversi ke PNG
    if (file.type === 'image/jpeg' || file.name?.endsWith('.jpg') || file.name?.endsWith('.jpeg')) {
      try {
        templateBuffer = await sharp(templateBuffer).png().toBuffer()
      } catch (err) {
        return NextResponse.json({ error: 'Gagal konversi JPG ke PNG', detail: String(err) }, { status: 400 })
      }
    }

    // Ambil dimensi template
    const templateMeta = await sharp(templateBuffer).metadata()
    const templateWidth = templateMeta.width || 0
    const templateHeight = templateMeta.height || 0
    console.log('DEBUG barcode/template:', { barcodeX, barcodeY, barcodeWidth, barcodeHeight, templateWidth, templateHeight })
    if (
      barcodeX < 0 || barcodeY < 0 ||
      barcodeWidth <= 0 || barcodeHeight <= 0 ||
      barcodeX + barcodeWidth > templateWidth ||
      barcodeY + barcodeHeight > templateHeight
    ) {
      return NextResponse.json({
        error: `Ukuran/posisi barcode melebihi batas template. Dimensi template: ${templateWidth}x${templateHeight}px, barcode: (${barcodeX},${barcodeY},${barcodeWidth},${barcodeHeight})`,
        templateWidth,
        templateHeight,
        barcodeX,
        barcodeY,
        barcodeWidth,
        barcodeHeight
      }, { status: 400 })
    }

    // Ukuran tiket dan layout grid (A4: 2480x3508 px @300dpi)
    const PAGE_W = 2480
    const PAGE_H = 3508
    const TICKET_W = 1240 // 2480/2
    const TICKET_H = 702
    const COLS = 2
    const ROWS = 5
    const MARGIN_X = 10
    const MARGIN_Y = 10
    const TICKETS_PER_PAGE = COLS * ROWS

    // Resize template ke ukuran tiket (anti error composite)
    const resizedTemplateBuffer = await sharp(templateBuffer)
      .resize(TICKET_W, TICKET_H)
      .png()
      .toBuffer()
    // Hitung skala dari template asli ke template resize
    const scaleX = TICKET_W / templateWidth
    const scaleY = TICKET_H / templateHeight
    const scaledBarcodeX = Math.round(barcodeX * scaleX)
    const scaledBarcodeY = Math.round(barcodeY * scaleY)
    const scaledBarcodeWidth = Math.round(barcodeWidth * scaleX)
    const scaledBarcodeHeight = Math.round(barcodeHeight * scaleY)

    // Pastikan barcode selalu muat di template resize
    let safeBarcodeWidth = scaledBarcodeWidth
    let safeBarcodeHeight = scaledBarcodeHeight
    let safeBarcodeX = scaledBarcodeX
    let safeBarcodeY = scaledBarcodeY
    if (safeBarcodeWidth > TICKET_W) safeBarcodeWidth = TICKET_W - 10
    if (safeBarcodeHeight > TICKET_H) safeBarcodeHeight = TICKET_H - 10
    if (safeBarcodeX < 0) safeBarcodeX = 0
    if (safeBarcodeY < 0) safeBarcodeY = 0
    if (safeBarcodeX + safeBarcodeWidth > TICKET_W) safeBarcodeX = TICKET_W - safeBarcodeWidth
    if (safeBarcodeY + safeBarcodeHeight > TICKET_H) safeBarcodeY = TICKET_H - safeBarcodeHeight

    // Generate tiket images
    const ticketImages: Buffer[] = []
    for (const p of participants) {
      try {
        // Generate barcode
        const barcodePng = await bwipjs.toBuffer({
          bcid: 'code128',
          text: p.token,
          scale: 3,
          height: safeBarcodeHeight,
          width: safeBarcodeWidth,
          includetext: false,
          backgroundcolor: 'FFFFFF',
        })
        // Overlay barcode ke template yang sudah di-resize
        const ticketImg = await sharp(resizedTemplateBuffer)
          .composite([
            { input: barcodePng, left: safeBarcodeX, top: safeBarcodeY }
          ])
          .png()
          .toBuffer()
        ticketImages.push(ticketImg)
      } catch (err) {
        console.error('Barcode/template error:', err)
        return NextResponse.json({ error: 'Gagal generate barcode/tiket', detail: String(err), token: p.token }, { status: 500 })
      }
    }

    // Generate PDF grid 2x5
    const doc = new PDFDocument({ size: [PAGE_W, PAGE_H], margin: 0 })
    const pdfChunks: Buffer[] = []
    doc.on('data', chunk => pdfChunks.push(chunk))
    doc.on('end', () => {})

    let i = 0
    while (i < ticketImages.length) {
      if (i > 0) doc.addPage()
      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          if (i >= ticketImages.length) break
          const x = col * (TICKET_W + MARGIN_X) + MARGIN_X
          const y = row * (TICKET_H + MARGIN_Y) + MARGIN_Y
          doc.image(ticketImages[i], x, y, { width: TICKET_W, height: TICKET_H })
          i++
        }
      }
    }
    doc.end()
    await new Promise(res => doc.on('end', res))
    const pdfBuffer = Buffer.concat(pdfChunks)

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="offline-tickets.pdf"',
      },
    })
  } catch (err) {
    console.error('Generate offline tickets error:', err)
    return NextResponse.json({ error: 'Failed to generate tickets', detail: String(err) }, { status: 500 })
  }
} 