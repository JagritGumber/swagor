import type { ReaderSession, ReaderSessionConfig, ReaderSessionWindow } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

export const DEFAULT_READER_SESSION_WINDOWS: ReaderSessionWindow[] = [
  { label: "asia", startMinuteUtc: 0, endMinuteUtc: 8 * 60 },
  { label: "europe", startMinuteUtc: 8 * 60, endMinuteUtc: 13 * 60 + 30 },
  { label: "us", startMinuteUtc: 13 * 60 + 30, endMinuteUtc: 21 * 60 },
  { label: "off-hours", startMinuteUtc: 21 * 60, endMinuteUtc: 24 * 60 },
];

export function readerSessionFor(input: {
  at: number;
  config?: ReaderSessionConfig;
}): ReaderSession {
  const windows = input.config?.windows ?? DEFAULT_READER_SESSION_WINDOWS;
  const minute = minuteOfUtcDay(input.at);
  const dayStart = utcDayStart(input.at);
  const window = windows.find((item) => minute >= item.startMinuteUtc && minute < item.endMinuteUtc)
    ?? windows[windows.length - 1]
    ?? DEFAULT_READER_SESSION_WINDOWS[0]!;
  const startAt = dayStart + window.startMinuteUtc * MINUTE_MS;
  const endAt = dayStart + window.endMinuteUtc * MINUTE_MS;
  return {
    id: `${new Date(dayStart).toISOString().slice(0, 10)}:${window.label}`,
    label: window.label,
    startAt,
    endAt,
    minutesFromOpen: Math.max(0, Math.floor((input.at - startAt) / MINUTE_MS)),
  };
}

function minuteOfUtcDay(at: number): number {
  const date = new Date(at);
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

function utcDayStart(at: number): number {
  return Math.floor(at / DAY_MS) * DAY_MS;
}


