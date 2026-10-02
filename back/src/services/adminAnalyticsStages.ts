import { ACQUISITION_FUNNEL_STAGE_KEYS } from '../config/analytics.js'

export type AcquisitionFunnelStageKey =
  (typeof ACQUISITION_FUNNEL_STAGE_KEYS)[number]

export type AcquisitionStageEvidence = Record<
  AcquisitionFunnelStageKey,
  boolean
>

export function getCurrentAcquisitionStage(
  stages: AcquisitionStageEvidence,
): AcquisitionFunnelStageKey {
  for (
    let index = ACQUISITION_FUNNEL_STAGE_KEYS.length - 1;
    index >= 0;
    index -= 1
  ) {
    const stage = ACQUISITION_FUNNEL_STAGE_KEYS[index]!
    if (stages[stage]) return stage
  }

  return 'ownerSignupStarted'
}
