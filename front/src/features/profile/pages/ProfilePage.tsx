import { useEffect, useState, type FormEvent } from 'react'
import {
  getProfile,
  saveProfile,
  uploadResume,
} from '../services/profileApi'
import type { ResumeProfileInput } from '../types/profile'

type ProfileFormState = Omit<
  ResumeProfileInput,
  'salaryExpectation'
> & {
  salaryExpectation: string
}

const emptyProfile: ProfileFormState = {
  fullName: '',
  targetRole: '',
  location: '',
  salaryExpectation: '',
  skills: '',
  experienceText: '',
  resumeText: '',
}

function profileToFormState(
  profile: ResumeProfileInput,
): ProfileFormState {
  return {
    fullName: profile.fullName,
    targetRole: profile.targetRole,
    location: profile.location,
    salaryExpectation:
      profile.salaryExpectation === 0
        ? ''
        : String(profile.salaryExpectation),
    skills: profile.skills,
    experienceText: profile.experienceText,
    resumeText: profile.resumeText,
  }
}

function ProfilePage() {
  const [form, setForm] = useState<ProfileFormState>(emptyProfile)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    async function loadProfile() {
      try {
        const profile = await getProfile()

        if (isActive && profile) {
          setForm(profileToFormState(profile))
        }
      } catch (error) {
        if (isActive) {
          setError(
            error instanceof Error ? error.message : 'Failed to load profile',
          )
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadProfile()

    return () => {
      isActive = false
    }
  }, [])

  function updateField(
    field: keyof ProfileFormState,
    value: string,
  ) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setWarning(null)
    setSuccessMessage(null)
    setIsSaving(true)

    try {
      const savedProfile = await saveProfile({
        ...form,
        salaryExpectation: Number(form.salaryExpectation) || 0,
      })

      setForm(profileToFormState(savedProfile))
      setSuccessMessage('Saved successfully.')
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Failed to save profile',
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function handleResumeUpload() {
    setError(null)
    setWarning(null)
    setSuccessMessage(null)

    if (!resumeFile) {
      setError('Select a PDF resume first.')
      return
    }

    const hasPdfType = resumeFile.type === 'application/pdf'
    const hasPdfExtension = resumeFile.name.toLowerCase().endsWith('.pdf')

    if (!hasPdfType && !(resumeFile.type === '' && hasPdfExtension)) {
      setError('Resume must be a PDF file.')
      return
    }

    setIsUploading(true)

    try {
      const result = await uploadResume(resumeFile)

      if (result.warning) {
        setForm((currentForm) => ({
          ...currentForm,
          resumeText: result.resumeText,
        }))
        setWarning(result.warning)
      } else {
        setForm(profileToFormState(result.profileDraft))
        setSuccessMessage(
          'Profile draft generated. Review it, then save your profile.',
        )
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Failed to upload resume',
      )
    } finally {
      setIsUploading(false)
    }
  }

  if (isLoading) {
    return (
      <section className="profile-page">
        <div className="page-header">
          <div>
            <h1>Profile</h1>
            <p>Build your profile from your resume.</p>
          </div>
        </div>
        <p className="status-message">Loading profile...</p>
      </section>
    )
  }

  return (
    <section className="profile-page">
      <div className="page-header">
        <div>
          <h1>Profile</h1>
          <p>Build your profile from your resume.</p>
        </div>
      </div>

      <form className="profile-form" onSubmit={handleSubmit}>
        <section className="profile-resume-upload">
          <div>
            <h2>Upload your resume</h2>
            <p>
              Upload your CV and Peeps will fill the profile for you. Nothing
              is saved until you review the draft and save your profile.
            </p>
          </div>
          <input
            type="file"
            accept=".pdf,application/pdf"
            onChange={(event) => {
              setResumeFile(event.target.files?.[0] ?? null)
              setError(null)
              setWarning(null)
              setSuccessMessage(null)
            }}
          />
          <button
            type="button"
            onClick={() => void handleResumeUpload()}
            disabled={isUploading}
          >
            {isUploading
              ? 'Building profile...'
              : 'Upload and build profile'}
          </button>
        </section>

        <div className="profile-form-heading">
          <h2>Review and save</h2>
          <p>No resume yet? You can fill the profile manually.</p>
        </div>

        <label>
          Full name
          <input
            value={form.fullName}
            onChange={(event) => updateField('fullName', event.target.value)}
          />
        </label>

        <label>
          Target role
          <input
            value={form.targetRole}
            onChange={(event) => updateField('targetRole', event.target.value)}
          />
        </label>

        <label>
          Location
          <input
            value={form.location}
            onChange={(event) => updateField('location', event.target.value)}
          />
        </label>

        <label>
          Salary expectation
          <input
            type="number"
            value={form.salaryExpectation}
            onChange={(event) =>
              updateField('salaryExpectation', event.target.value)
            }
          />
        </label>

        <label className="profile-field-wide">
          Skills
          <textarea
            rows={3}
            value={form.skills}
            onChange={(event) => updateField('skills', event.target.value)}
          />
        </label>

        <label className="profile-field-wide">
          Experience
          <textarea
            rows={5}
            value={form.experienceText}
            onChange={(event) =>
              updateField('experienceText', event.target.value)
            }
          />
        </label>

        <label className="profile-field-wide">
          Resume text
          {!form.resumeText && (
            <span className="field-helper">
              No resume text yet. Upload a PDF above or paste your resume
              here, then save your profile.
            </span>
          )}
          <textarea
            rows={9}
            value={form.resumeText}
            onChange={(event) => updateField('resumeText', event.target.value)}
          />
        </label>

        {error && (
          <p className="message message-error" role="alert">
            {error}
          </p>
        )}

        {warning && (
          <p className="message message-warning" role="status">
            {warning}
          </p>
        )}

        {successMessage && (
          <p className="message message-success" aria-live="polite">
            {successMessage}
          </p>
        )}

        <button type="submit" disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save profile'}
        </button>
      </form>
    </section>
  )
}

export default ProfilePage
