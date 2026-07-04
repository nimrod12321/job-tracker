import { zodTextFormat } from 'openai/helpers/zod'
import {
  AiServiceError,
  getOpenAIConfiguration,
} from './ai.service.js'
import {
  extractedJobFieldsSchema,
  type ExtractedJobFields,
} from '../validations/jobImport.validation.js'

export async function extractJobFields(
  jobDescription: string,
): Promise<ExtractedJobFields> {
  const { client, model } = getOpenAIConfiguration()

  try {
    const response = await client.responses.parse({
      model,
      instructions: [
        'Extract structured job fields from the supplied job description.',
        'Do not invent facts.',
        'If a text field is unclear, return an empty string.',
        'If a salary field is unclear, return 0.',
        'Only extract salary values explicitly supported by the text.',
        'Only return a company URL when it is obvious from the text.',
        'Notes may contain only useful facts explicitly stated in the description.',
      ].join(' '),
      input: jobDescription,
      text: {
        format: zodTextFormat(
          extractedJobFieldsSchema,
          'job_import_fields',
        ),
      },
    })

    if (!response.output_parsed) {
      throw new Error('OpenAI returned no parsed job fields')
    }

    return extractedJobFieldsSchema.parse(response.output_parsed)
  } catch (error) {
    console.error('OpenAI job import failed:', error)
    throw new AiServiceError('failed to extract job details')
  }
}
