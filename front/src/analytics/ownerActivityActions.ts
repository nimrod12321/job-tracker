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
