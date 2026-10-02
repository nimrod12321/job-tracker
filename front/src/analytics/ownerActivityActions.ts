export type OwnerCandidateReference = {
  kind: 'externalLead' | 'jobApplication'
  id: string
}

export type OwnerActivityEvent =
  | {
      eventName: 'recruitment_kit_opened'
      properties?: Record<string, never>
    }
  | {
      eventName: 'hiring_link_copied'
      properties: { method: 'button' }
    }
  | {
      eventName: 'poster_download_started' | 'qr_download_started'
      properties: { format: 'png' }
    }
  | {
      eventName: 'instagram_assist_opened'
      properties: { context: 'story_assist' }
    }
  | {
      eventName: 'candidate_card_opened'
      candidateReference: OwnerCandidateReference
      properties?: Record<string, never>
    }
  | {
      eventName: 'candidate_contact_initiated'
      candidateReference: OwnerCandidateReference
      properties: { channel: 'phone' | 'whatsapp' }
    }

export type OwnerActivityRecorder = (
  event: OwnerActivityEvent,
) => unknown | Promise<unknown>

function recordWithoutBlocking(
  record: OwnerActivityRecorder,
  event: OwnerActivityEvent,
) {
  try {
    void Promise.resolve(record(event)).catch(() => undefined)
  } catch {
    // Analytics must never affect the product action being observed.
  }
}

export function recordRecruitmentKitOpenTransition(
  wasOpen: boolean,
  isOpen: boolean,
  record: OwnerActivityRecorder,
) {
  if (wasOpen || !isOpen) return

  recordWithoutBlocking(record, {
    eventName: 'recruitment_kit_opened',
  })
}

export async function copyHiringLinkAndRecord(
  copy: () => Promise<boolean>,
  record: OwnerActivityRecorder,
) {
  const didCopy = await copy()

  if (didCopy) {
    recordWithoutBlocking(record, {
      eventName: 'hiring_link_copied',
      properties: { method: 'button' },
    })
  }

  return didCopy
}

export function recordQrAssetDownloadStarted(
  format: 'poster' | 'qr',
  record: OwnerActivityRecorder,
) {
  recordWithoutBlocking(record, {
    eventName:
      format === 'poster'
        ? 'poster_download_started'
        : 'qr_download_started',
    properties: { format: 'png' },
  })
}

export function recordInstagramAssistOpened(
  record: OwnerActivityRecorder,
) {
  recordWithoutBlocking(record, {
    eventName: 'instagram_assist_opened',
    properties: { context: 'story_assist' },
  })
}

const CANDIDATE_ACTION_DEDUPE_MS = 750

export type CandidateActivityGuard = Map<string, number>

export function createCandidateActivityGuard(): CandidateActivityGuard {
  return new Map()
}

function recordCandidateAction(
  actionKey: string,
  event: OwnerActivityEvent,
  guard: CandidateActivityGuard,
  record: OwnerActivityRecorder,
  now: number,
) {
  const previousAttemptAt = guard.get(actionKey)
  if (
    previousAttemptAt !== undefined &&
    now - previousAttemptAt < CANDIDATE_ACTION_DEDUPE_MS
  ) {
    return
  }

  guard.set(actionKey, now)
  recordWithoutBlocking(record, event)
}

export function recordCandidateCardOpened(
  candidateReference: OwnerCandidateReference,
  guard: CandidateActivityGuard,
  record: OwnerActivityRecorder,
  now = Date.now(),
) {
  recordCandidateAction(
    `open:${candidateReference.kind}:${candidateReference.id}`,
    {
      eventName: 'candidate_card_opened',
      candidateReference,
    },
    guard,
    record,
    now,
  )
}

export function recordCandidateContactInitiated(
  candidateReference: OwnerCandidateReference,
  channel: 'phone' | 'whatsapp',
  guard: CandidateActivityGuard,
  record: OwnerActivityRecorder,
  now = Date.now(),
) {
  recordCandidateAction(
    `contact:${channel}:${candidateReference.kind}:${candidateReference.id}`,
    {
      eventName: 'candidate_contact_initiated',
      candidateReference,
      properties: { channel },
    },
    guard,
    record,
    now,
  )
}
