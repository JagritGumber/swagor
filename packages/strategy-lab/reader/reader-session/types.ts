export type ReaderSessionLabel =
  | "asia"
  | "europe"
  | "us"
  | "off-hours";

export type ReaderSession = {
  id: string;
  label: ReaderSessionLabel;
  startAt: number;
  endAt: number;
  minutesFromOpen: number;
};

export type ReaderSessionWindow = {
  label: ReaderSessionLabel;
  startMinuteUtc: number;
  endMinuteUtc: number;
};

export type ReaderSessionConfig = {
  windows?: ReaderSessionWindow[];
};



