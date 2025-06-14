import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { writeFile, mkdir, access } from 'fs/promises'
import path from 'path'
import db from '@/lib/db'

export async function POST() {
  try {
    // Ambil semua tiket dari database
    const [tickets] = await db.execute('SELECT id, token FROM tickets')
    const ticketsDir = path.join(process.cwd(), 'public', 'tickets')
    try { await access(ticketsDir) } catch { await mkdir(ticketsDir, { recursive: true }) }
    let count = 0
    for (const t of tickets as any[]) {
      const qrPath = path.join(ticketsDir, `qr_${t.token}.png`)
      const qrUrl = `/tickets/qr_${t.token}.png`
      // Generate QR code PNG
      const qrBuffer = await QRCode.toBuffer(`${process.env.SERVER_URL || 'http://localhost:3000'}/register?token=${t.token}`, {
        width: 400,
        margin: 4,
        color: { dark: '#000000', light: '#FFFFFF' },
        errorCorrectionLevel: 'H',
        type: 'png',
      })
      await writeFile(qrPath, qrBuffer)
      // Update database jika perlu
      await db.execute('UPDATE tickets SET qr_code_url = ? WHERE id = ?', [qrUrl, t.id])
      count++
    }
    return NextResponse.json({ message: `Regenerated ${count} QR codes.` })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to regenerate QR codes', detail: String(err) }, { status: 500 })
  }
} 