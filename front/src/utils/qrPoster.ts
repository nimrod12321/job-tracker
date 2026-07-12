import QRCode from 'qrcode'

const POSTER_WIDTH = 1079
const POSTER_HEIGHT = 1536
const QR_BOX_X = 328
const QR_BOX_Y = 995
const QR_BOX_SIZE = 420
const QR_INSET = 28
const POSTER_GREEN = '#285d3f'
const POSTER_BLACK = '#171717'
const POSTER_BACKGROUND = '#fffdf7'

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

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath()
  context.moveTo(x + radius, y)
  context.lineTo(x + width - radius, y)
  context.quadraticCurveTo(x + width, y, x + width, y + radius)
  context.lineTo(x + width, y + height - radius)
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  context.lineTo(x + radius, y + height)
  context.quadraticCurveTo(x, y + height, x, y + height - radius)
  context.lineTo(x, y + radius)
  context.quadraticCurveTo(x, y, x + radius, y)
  context.closePath()
}

function drawHebrewText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: {
    color?: string
    font: string
    maxWidth?: number
  },
) {
  context.save()
  context.direction = 'rtl'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = options.color ?? POSTER_BLACK
  context.font = options.font
  context.fillText(text, x, y, options.maxWidth)
  context.restore()
}

function drawSpacedText(
  context: CanvasRenderingContext2D,
  letters: Array<{ value: string; color: string; font: string }>,
  startX: number,
  y: number,
  spacing: number,
) {
  let currentX = startX

  for (const letter of letters) {
    context.fillStyle = letter.color
    context.font = letter.font
    context.fillText(letter.value, currentX, y)
    currentX += context.measureText(letter.value).width + spacing
  }
}

function drawPeepssLogo(context: CanvasRenderingContext2D) {
  context.save()
  context.textBaseline = 'middle'
  context.fillStyle = POSTER_GREEN
  context.beginPath()
  context.arc(500, 262, 150, 0, Math.PI * 2)
  context.fill()

  context.textAlign = 'left'
  drawSpacedText(
    context,
    [
      {
        value: 'p',
        color: POSTER_BLACK,
        font: '200 190px "Helvetica Neue", Arial, sans-serif',
      },
      {
        value: 'e',
        color: '#ffffff',
        font: '900 190px "Helvetica Neue", Arial, sans-serif',
      },
      {
        value: 'e',
        color: '#ffffff',
        font: '900 190px "Helvetica Neue", Arial, sans-serif',
      },
      {
        value: 'p',
        color: POSTER_BLACK,
        font: '200 190px "Helvetica Neue", Arial, sans-serif',
      },
      {
        value: 's',
        color: POSTER_BLACK,
        font: '200 190px "Helvetica Neue", Arial, sans-serif',
      },
      {
        value: 's',
        color: POSTER_BLACK,
        font: '200 190px "Helvetica Neue", Arial, sans-serif',
      },
    ],
    268,
    258,
    -10,
  )
  context.restore()
}

function drawPosterTemplate(context: CanvasRenderingContext2D) {
  context.fillStyle = POSTER_BACKGROUND
  context.fillRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT)

  drawPeepssLogo(context)

  context.strokeStyle = POSTER_GREEN
  context.lineWidth = 3
  context.beginPath()
  context.moveTo(285, 500)
  context.lineTo(505, 500)
  context.moveTo(580, 500)
  context.lineTo(800, 500)
  context.stroke()

  context.fillStyle = POSTER_GREEN
  context.beginPath()
  context.arc(542, 500, 8, 0, Math.PI * 2)
  context.fill()

  drawHebrewText(context, 'רוצים לעבוד כאן?', 540, 650, {
    font: '900 112px Arial, sans-serif',
    maxWidth: 1000,
  })

  context.fillStyle = POSTER_GREEN
  drawRoundedRect(context, 48, 750, 983, 112, 13)
  context.fill()

  drawHebrewText(context, 'הגישו מועמדות למשרה במסעדה הזו', 540, 808, {
    color: '#ffffff',
    font: '900 58px Arial, sans-serif',
    maxWidth: 900,
  })

  drawHebrewText(context, 'סרקו את הקוד והגישו מועמדות בקלות ובמהירות', 540, 932, {
    font: '500 44px Arial, sans-serif',
    maxWidth: 910,
  })

  context.fillStyle = POSTER_BACKGROUND
  drawRoundedRect(context, QR_BOX_X, QR_BOX_Y, QR_BOX_SIZE, QR_BOX_SIZE, 15)
  context.fill()
  context.strokeStyle = POSTER_GREEN
  context.lineWidth = 4
  context.stroke()

  context.strokeStyle = POSTER_GREEN
  context.lineWidth = 3
  context.beginPath()
  context.moveTo(86, 1470)
  context.lineTo(266, 1470)
  context.moveTo(812, 1470)
  context.lineTo(994, 1470)
  context.stroke()

  drawHebrewText(context, 'דרושים/ות למגוון תפקידים', 540, 1478, {
    font: '500 43px Arial, sans-serif',
    maxWidth: 520,
  })
}

function sanitizeFileNamePart(value: string) {
  return value.trim().replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '')
}

export async function downloadQrPoster({
  publicUrl,
  slug,
}: DownloadQrPosterOptions) {
  const qrImage = await QRCode.toDataURL(publicUrl, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 900,
      color: {
        dark: '#1f1d1e',
        light: '#ffffff',
      },
    }).then(loadImage)

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Canvas is not available.')
  }

  canvas.width = POSTER_WIDTH
  canvas.height = POSTER_HEIGHT

  drawPosterTemplate(context)

  context.fillStyle = '#ffffff'
  context.fillRect(
    QR_BOX_X + 6,
    QR_BOX_Y + 6,
    QR_BOX_SIZE - 12,
    QR_BOX_SIZE - 12,
  )

  context.drawImage(
    qrImage,
    QR_BOX_X + QR_INSET,
    QR_BOX_Y + QR_INSET,
    QR_BOX_SIZE - QR_INSET * 2,
    QR_BOX_SIZE - QR_INSET * 2,
  )

  const link = document.createElement('a')
  const safeSlug = sanitizeFileNamePart(slug) || 'restaurant'

  link.href = canvas.toDataURL('image/png')
  link.download = `peepss-${safeSlug}-qr-poster.png`
  link.click()
}

export const qrPosterPlacement = {
  x: QR_BOX_X,
  y: QR_BOX_Y,
  size: QR_BOX_SIZE,
  inset: QR_INSET,
}
