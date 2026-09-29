/** Records a denied RBAC access attempt. Never throws. */
export async function logAccessDenied(
  _module: string,
  _action: string,
  _entityId?: string | null,
  _reason?: string,
  _tenantId?: string | null,
): Promise<void> {
  // no-op until the backend exposes an endpoint (see TODO above)
}
 
/** Records a successful staff-gated access (page view). Never throws. */
export async function logAccessGranted(
  _module: string,
  _action: string,
  _tenantId?: string | null,
  _entityId?: string | null,
): Promise<void> {
  // no-op until the backend exposes an endpoint (see TODO above)
}