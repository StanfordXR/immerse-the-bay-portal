export type CheckInTarget =
  | { kind: "hacker"; id: string }
  | { kind: "staff"; id: string };

export type CheckInPerson = {
  id: string;
  name: string;
  emailHint: string;
  checkedInAt: string | null;
};

export type CheckInResult = {
  person: CheckInPerson;
  alreadyCheckedIn: boolean;
};

export type CheckInStats = {
  confirmedHackers: number;
  checkedInHackers: number;
  checkedInStaff: number;
  latestHackerCheckInAt: string | null;
};
