export async function isDuplicateEvent(event, repo) {
  if (!event.external_id) return false;

  const existing = await repo.findByExternalId(
    event.store_id,
    event.external_id,
    event.type
  );

  return !!existing;
}
