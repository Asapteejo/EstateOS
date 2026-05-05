export function getPropertyCountdownParts(targetTime: number, now: number) {
  const remaining = Math.max(0, targetTime - now);
  const totalMinutes = Math.floor(remaining / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes - days * 60 * 24) / 60);
  const minutes = totalMinutes % 60;

  return { days, hours, minutes, expired: remaining <= 0 };
}

