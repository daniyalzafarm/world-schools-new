// Utility to parse duration strings like '7d', '15m', '1h', '30s' into milliseconds
export const parseDuration = (duration: string): number => {
  const match = /^([0-9]+)([smhd])$/.exec(duration.trim());
  if (!match) throw new Error(`Invalid duration string: ${duration}`);
  const value = parseInt(match[1], 10);
  switch (match[2]) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Invalid duration unit in: ${duration}`);
  }
};

