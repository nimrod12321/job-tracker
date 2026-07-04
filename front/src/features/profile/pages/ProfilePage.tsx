import { useEffect, useState, type FormEvent } from 'react'
import {
  getProfile,
  saveProfile,
  uploadResume,
} from '../services/profileApi'
import type {
  ResumeProfile,
  ResumeProfileInput,
} from '../types/profile'

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

function profileToFormState(profile: ResumeProfile): ProfileFormState {
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
    setSuccessMessage(null)
    setIsSaving(true)

    try {
      const savedProfile = await saveProfile({
        ...form,
        salaryExpectation: Number(form.salaryExpectation) || 0,
      })

      setForm(profileToFormState(savedProfile))
      setSuccessMessage('Profile saved successfully.')
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
      updateField('resumeText', result.resumeText)
      setSuccessMessage(
        'Resume text extracted. Review and save your profile.',
      )
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
        <h1>Profile</h1>
        <p>Loading profile...</p>
      </section>
    )
  }

  return (
    <section className="profile-page">
      <div className="page-header">
        <div>
          <h1>Profile</h1>
          <p>Add the career information that will support future AI tools.</p>
        </div>
      </div>

      <form className="profile-form" onSubmit={handleSubmit}>
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

        <section className="profile-resume-upload">
          <div>
            <h2>Upload PDF resume</h2>
            <p>
              Extracted text will be placed below for review. It will not be
              saved until you save your profile.
            </p>
          </div>
          <input
            type="file"
            accept=".pdf,application/pdf"
            onChange={(event) => {
              setResumeFile(event.target.files?.[0] ?? null)
              setError(null)
              setSuccessMessage(null)
            }}
          />
          <button
            type="button"
            onClick={() => void handleResumeUpload()}
            disabled={isUploading}
          >
            {isUploading ? 'Extracting...' : 'Upload and extract'}
          </button>
        </section>

        <label className="profile-field-wide">
          Resume text
          <textarea
            rows={9}
            value={form.resumeText}
            onChange={(event) => updateField('resumeText', event.target.value)}
          />
        </label>

        {error && (
          <p className="profile-message profile-error" role="alert">
            {error}
          </p>
        )}

        {successMessage && (
          <p className="profile-message profile-success" aria-live="polite">
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
