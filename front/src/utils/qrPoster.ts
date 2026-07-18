import QRCode from 'qrcode'

const POSTER_TEMPLATE_SRC = '/assets/peepss-qr-poster-template.png'
const POSTER_TEMPLATE_WIDTH = 1696
const POSTER_TEMPLATE_HEIGHT = 2400

// Pixel coordinates on /assets/peepss-qr-poster-template.png.
// The template PNG was exported from the provided PDF at 1696×2400.
const QR_BOX_X = 580
const QR_BOX_Y = 1004
const QR_BOX_WIDTH = 533
const QR_BOX_HEIGHT = 503
const QR_PADDING = 24
const QR_BACKGROUND_BLEED = 6

type DownloadQrPosterOptions = {
  publicUrl: string
  slug: string
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()

    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Failed to load QR poster image.'))
    image.src = src
  })
}

function sanitizeFileNamePart(value: string) {
  return value.trim().replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '')
}

export async function downloadQrPoster({
  publicUrl,
  slug,
}: DownloadQrPosterOptions) {
  const posterDataUrl = await createQrPosterDataUrl(publicUrl)
  const link = document.createElement('a')
  const safeSlug = sanitizeFileNamePart(slug) || 'restaurant'

  link.href = posterDataUrl
  link.download = `peepss-${safeSlug}-qr-poster.png`
  link.click()
}

export async function createQrPosterDataUrl(publicUrl: string) {
  const [posterTemplate, qrImage] = await Promise.all([
    loadImage(POSTER_TEMPLATE_SRC),
    QRCode.toDataURL(publicUrl, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 900,
      color: {
        dark: '#1f1d1e',
        light: '#ffffff',
      },
    }).then(loadImage),
  ])
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Canvas is not available.')
  }

  canvas.width = posterTemplate.naturalWidth
  canvas.height = posterTemplate.naturalHeight

  context.drawImage(posterTemplate, 0, 0)

  const qrSize = Math.min(QR_BOX_WIDTH, QR_BOX_HEIGHT) - QR_PADDING * 2
  const qrX = QR_BOX_X + (QR_BOX_WIDTH - qrSize) / 2
  const qrY = QR_BOX_Y + (QR_BOX_HEIGHT - qrSize) / 2

  context.fillStyle = '#ffffff'
  context.fillRect(
    QR_BOX_X - QR_BACKGROUND_BLEED,
    QR_BOX_Y - QR_BACKGROUND_BLEED,
    QR_BOX_WIDTH + QR_BACKGROUND_BLEED * 2,
    QR_BOX_HEIGHT + QR_BACKGROUND_BLEED * 2,
  )

  context.drawImage(qrImage, qrX, qrY, qrSize, qrSize)

  return canvas.toDataURL('image/png')
}

export const qrPosterPlacement = {
  templateSrc: POSTER_TEMPLATE_SRC,
  templateWidth: POSTER_TEMPLATE_WIDTH,
  templateHeight: POSTER_TEMPLATE_HEIGHT,
  x: QR_BOX_X,
  y: QR_BOX_Y,
  width: QR_BOX_WIDTH,
  height: QR_BOX_HEIGHT,
  padding: QR_PADDING,
  backgroundBleed: QR_BACKGROUND_BLEED,
}
