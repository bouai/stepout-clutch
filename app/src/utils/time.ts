/**
 * Human-readable age of a server timestamp.
 *
 * The API emits UTC with an explicit `Z`. That matters: JS parses an
 * offset-less date-time string as *local* time, so a naive timestamp would
 * read as hours old the instant it was written.
 */
export function formatRelativeTime(isoTimestamp: string, now: number = Date.now()): string {
  const parsed = new Date(isoTimestamp).getTime();
  if (Number.isNaN(parsed)) return 'unknown';

  const seconds = Math.max(0, Math.floor((now - parsed) / 1000));

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
