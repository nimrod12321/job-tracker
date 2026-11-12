export function shouldRenderOwnerJobForm(
  editingJobId: string | null,
  developmentCreationEnabled: boolean,
) {
  return Boolean(editingJobId) || developmentCreationEnabled
}
