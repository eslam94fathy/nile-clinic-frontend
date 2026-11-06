import "server-only";

// All of this is made up, and is meant to look it. It stays in server code, so it reaches the browser
// only when the preview is on and rendering it.
export const sampleValues = {
  money: "150.00",
  moneyNegative: "-1250.50",
  moneyLarge: "12345678901234567.89",
  moneyMalformed: "150",
  date: "2026-11-08",
  dateMalformed: "2026-13-45",
  time: "09:20",
  timeEndOfDay: "24:00",
  instantLong: "2026-11-05T22:30:00.000000Z",
  instantOffset: "2026-11-05T22:30:00+00:00",
  phone: "+201000000017",
  nationalId: "29900000000017",
  userTextLatin: "Test Patient Alpha",
  userTextArabic: "مريض تجريبي باء",
};

export type SampleVisit = {
  id: string;
  number: string;
  name: string;
  phone: string;
  doctor: string;
  time: string;
  visit: "waiting" | "with_doctor" | "seen" | "left";
  charge: "none" | "unpaid" | "partially_paid" | "paid";
  balance: string | null;
};

export const sampleVisits: SampleVisit[] = [
  {
    id: "17",
    number: "17",
    name: "Test Patient Alpha",
    phone: "+201000000017",
    doctor: "Dr. Sample One",
    time: "09:20",
    visit: "with_doctor",
    charge: "partially_paid",
    balance: "150.00",
  },
  {
    id: "18",
    number: "18",
    name: "مريض تجريبي باء",
    phone: "+201000000018",
    doctor: "د. نموذج اثنان",
    time: "09:35",
    visit: "waiting",
    charge: "none",
    balance: null,
  },
  {
    id: "19",
    number: "19",
    name: "Test-Patient-With-A-Very-Long-Unbroken-Synthetic-Name-For-Layout-Testing-Only",
    phone: "+201000000019",
    doctor: "Dr. Sample One",
    time: "09:40",
    visit: "seen",
    charge: "paid",
    balance: "0.00",
  },
  {
    id: "14",
    number: "14",
    name: "مريض تجريبي دال باسم طويل جدا لاختبار التفاف النص في الجدول فقط",
    phone: "+201000000014",
    doctor: "د. نموذج اثنان",
    time: "08:45",
    visit: "left",
    charge: "unpaid",
    balance: "1250.50",
  },
];
