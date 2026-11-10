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
