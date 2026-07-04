import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { JobAnalysis } from '../../../types/job'

type CopyableField =
  | 'resumeSuggestions'
  | 'interviewQuestions'
  | 'recruiterMessage'

type JobAnalysisPanelProps = {
  analysis: JobAnalysis | null
  error: string | null
  isAnalyzing: boolean
  onAnalyze: () => void
}

function getScoreLabel(score: number) {
  if (score >= 80) {
    return 'Strong match'
  }

  if (score >= 60) {
    return 'Good match'
  }

  if (score >= 40) {
    return 'Partial match'
  }

  return 'Weak match'
}

function JobAnalysisPanel({
  analysis,
  error,
  isAnalyzing,
  onAnalyze,
}: JobAnalysisPanelProps) {
  const [copiedField, setCopiedField] = useState<CopyableField | null>(null)
  const [copyError, setCopyError] = useState<string | null>(null)

  useEffect(() => {
    if (!copiedField) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setCopiedField(null)
    }, 2000)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [copiedField])

  function handleAnalyzeClick() {
    if (
      analysis &&
      !window.confirm(
        'This will replace the current saved analysis. Continue?',
      )
    ) {
      return
    }

    onAnalyze()
  }

  async function copyToClipboard(
    field: CopyableField,
    text: string,
  ) {
    setCopyError(null)

    try {
      if (!navigator.clipboard) {
        throw new Error('Clipboard API is unavailable')
      }

      await navigator.clipboard.writeText(text)
      setCopiedField(field)
    } catch {
      setCopiedField(null)
      setCopyError('Could not copy. Please copy the text manually.')
    }
  }

  return (
    <section className="job-analysis-section">
      <div className="job-analysis-header">
        <div>
          <p className="job-analysis-label">AI career assistant</p>
          <h2>Match analysis</h2>
        </div>
        <button
          type="button"
          onClick={handleAnalyzeClick}
          disabled={isAnalyzing}
        >
          {isAnalyzing
            ? 'Analyzing job...'
            : analysis
              ? 'Analyze again'
              : 'Analyze match'}
        </button>
      </div>

      {error && (
        <p className="message message-error" role="alert">
          {error}
        </p>
      )}

      {analysis ? (
        <>
          <div className="job-analysis-score">
            <strong>{analysis.matchScore}</strong>
            <div>
              <span>{getScoreLabel(analysis.matchScore)}</span>
              <small>Match score out of 100</small>
            </div>
          </div>

          <div className="job-analysis-grid">
            <article>
              <h3>Fit summary</h3>
              <p>{analysis.fitSummary}</p>
            </article>
            <article>
              <h3>Strengths</h3>
              <p>{analysis.strengths}</p>
            </article>
            <article>
              <h3>Missing skills</h3>
              <p>{analysis.missingSkills}</p>
            </article>
            <article>
              <div className="job-analysis-card-header">
                <h3>Resume suggestions</h3>
                <button
                  className="copy-button"
                  type="button"
                  onClick={() =>
                    void copyToClipboard(
                      'resumeSuggestions',
                      analysis.resumeSuggestions,
                    )
                  }
                >
                  {copiedField === 'resumeSuggestions' ? 'Copied.' : 'Copy'}
                </button>
              </div>
              <p>{analysis.resumeSuggestions}</p>
            </article>
            <article>
              <div className="job-analysis-card-header">
                <h3>Interview questions</h3>
                <button
                  className="copy-button"
                  type="button"
                  onClick={() =>
                    void copyToClipboard(
                      'interviewQuestions',
                      analysis.interviewQuestions,
                    )
                  }
                >
                  {copiedField === 'interviewQuestions' ? 'Copied.' : 'Copy'}
                </button>
              </div>
              <p>{analysis.interviewQuestions}</p>
            </article>
            <article>
              <div className="job-analysis-card-header">
                <h3>Recruiter message</h3>
                <button
                  className="copy-button"
                  type="button"
                  onClick={() =>
                    void copyToClipboard(
                      'recruiterMessage',
                      analysis.recruiterMessage,
                    )
                  }
                >
                  {copiedField === 'recruiterMessage' ? 'Copied.' : 'Copy'}
                </button>
              </div>
              <p>{analysis.recruiterMessage}</p>
            </article>
          </div>

          {copyError && (
            <p className="job-analysis-copy-error" role="status">
              {copyError}
            </p>
          )}

          <p className="job-analysis-date">
            Last analyzed: {analysis.updatedAt.slice(0, 10)}
          </p>
        </>
      ) : (
        <div className="job-analysis-empty">
          <strong>No AI analysis yet.</strong>
          <p>
            Complete your profile, add a job description, then analyze this
            job.
          </p>
          <Link to="/profile">Review profile</Link>
        </div>
      )}
    </section>
  )
}

export default JobAnalysisPanel
