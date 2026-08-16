import { formatRelativeTime } from '../time';

// A fixed "now" so these assertions never depend on wall-clock timing.
const NOW = Date.parse('2026-08-16T12:00:00Z');

describe('formatRelativeTime', () => {
  it('reports sub-minute ages as "just now"', () => {
    expect(formatRelativeTime('2026-08-16T11:59:30Z', NOW)).toBe('just now');
  });

  it('reports minutes', () => {
    expect(formatRelativeTime('2026-08-16T11:35:00Z', NOW)).toBe('25m ago');
  });

  it('reports hours', () => {
    expect(formatRelativeTime('2026-08-16T09:00:00Z', NOW)).toBe('3h ago');
  });

  it('reports days', () => {
    expect(formatRelativeTime('2026-08-14T12:00:00Z', NOW)).toBe('2d ago');
  });

  it('clamps future timestamps instead of rendering a negative age', () => {
    expect(formatRelativeTime('2026-08-16T12:05:00Z', NOW)).toBe('just now');
  });

  it('degrades gracefully on an unparseable timestamp', () => {
    expect(formatRelativeTime('not-a-date', NOW)).toBe('unknown');
  });

  it('treats a Z-suffixed timestamp as UTC regardless of device timezone', () => {
    // The regression this guards: the API once emitted offset-less datetimes,
    // which JS parses as *local* time. On a UTC+5:30 device that turned a
    // just-fired alert into "5h ago". With the `Z` present, the parse is
    // absolute and the result is timezone-independent.
    const withZ = formatRelativeTime('2026-08-16T11:59:30Z', NOW);
    expect(withZ).toBe('just now');

    const parsedZ = new Date('2026-08-16T11:59:30Z').getTime();
    expect(parsedZ).toBe(Date.UTC(2026, 7, 16, 11, 59, 30));
  });

  it('would misread an offset-less timestamp outside UTC — hence the Z', () => {
    // Documents *why* the server-side fix matters. In a non-UTC environment
    // these two parses differ; asserting the relationship rather than a fixed
    // value keeps the test honest wherever CI happens to run.
    const naive = new Date('2026-08-16T11:59:30').getTime();
    const absolute = new Date('2026-08-16T11:59:30Z').getTime();
    const offsetMinutes = new Date(absolute).getTimezoneOffset();
    expect(naive - absolute).toBe(offsetMinutes * 60 * 1000);
  });
});
