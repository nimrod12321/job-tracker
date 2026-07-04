import { PDFParse } from 'pdf-parse'

export class ResumeParseError extends Error {}

export async function extractResumeText(fileBuffer: Buffer) {
  const parser = new PDFParse({
    data: new Uint8Array(fileBuffer),
  })

  try {
    const result = await parser.getText({ pageJoiner: '' })
    const resumeText = result.text.trim()

    if (!resumeText) {
      throw new ResumeParseError('no readable text found in PDF')
    }

    return resumeText
  } catch (error) {
    if (error instanceof ResumeParseError) {
      throw error
    }

    console.error('PDF resume parsing failed:', error)
    throw new ResumeParseError('failed to extract text from PDF')
  } finally {
    await parser.destroy()
  }
}
