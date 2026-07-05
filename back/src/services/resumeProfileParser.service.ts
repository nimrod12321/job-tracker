import { zodTextFormat } from 'openai/helpers/zod'
import { getOpenAIConfiguration } from './ai.service.js'
import {
  resumeProfileDraftSchema,
  type ResumeProfileDraft,
} from '../validations/profile.validation.js'

const RESUME_PROFILE_PARSE_TIMEOUT_MS = 20_000

export class ResumeProfileParseError extends Error {}

export async function parseResumeProfile(
  resumeText: string,
): Promise<ResumeProfileDraft> {
  try {
    const { client, model } = getOpenAIConfiguration()
    const response = await client.responses.parse(
      {
        model,
        instructions: [
          'Extract a structured profile from the supplied resume text.',
          'Use only the resume text and do not invent facts.',
          'If a field is missing or unclear, return an empty string or 0.',
          'Do not exaggerate seniority.',
          'Infer the target role from recent experience and skills only when it is obvious.',
          'Return skills as a concise comma-separated list.',
          'Summarize only real experience from the resume in experienceText.',
          'Only return a salary expectation when explicitly stated in the resume.',
          'Return strict JSON only in the requested structure.',
        ].join(' '),
        input: resumeText,
        text: {
          format: zodTextFormat(
            resumeProfileDraftSchema,
            'resume_profile_draft',
          ),
        },
      },
      {
        maxRetries: 0,
        timeout: RESUME_PROFILE_PARSE_TIMEOUT_MS,
      },
    )

    if (!response.output_parsed) {
      throw new Error('OpenAI returned no parsed resume profile')
    }

    return resumeProfileDraftSchema.parse(response.output_parsed)
  } catch (error) {
    console.error('OpenAI resume profile parsing failed:', error)
    throw new ResumeProfileParseError(
      'failed to generate profile draft',
    )
  }
}
