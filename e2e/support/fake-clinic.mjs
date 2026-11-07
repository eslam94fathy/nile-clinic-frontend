// The clinic-setup part of the fake backend: staff, specialties, doctors, schedules, slots, time off, and
// fees. All data is synthetic. Refusals use the same statuses and error keys as the real API, checked
// against its contracts and form requests, so that the screens' mapping is tested against the real shape.
const DAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];
const START = /^([01][0-9]|2[0-3]):[0-5][05]$/;
const END = /^(([01][0-9]|2[0-3]):[0-5][05]|24:00)$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const REGISTRATION = /^[A-Za-z0-9]{1,30}$/;
const AMOUNT = /^\d+(\.\d{1,2})?$/;
const NOW = "2026-02-01T10:00:00.000000Z";
const APPOINTMENT_STATUSES = [
  "scheduled",
  "cancelled",
  "no_show",
  "checked_in",
  "completed",
];
const SLOT_UNAVAILABLE = "This time is not an available slot for this doctor.";

const minutes = (time) => {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
};
const clock = (total) =>
  `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;

const clinicToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const clinicClock = () =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Cairo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());

const dayNumber = (date) => {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
};
const dateOf = (number) =>
  new Date(number * 86_400_000).toISOString().slice(0, 10);

function freshClinic() {
  return {
    specialties: [
      {
        id: 1,
        name_en: "Synthetic Cardiology",
        name_ar: "قلب تجريبي",
        is_active: true,
      },
      {
        id: 2,
        name_en: "Synthetic Dermatology",
        name_ar: "جلدية تجريبية",
        is_active: true,
      },
      {
        id: 3,
        name_en: "Synthetic Retired",
        name_ar: "تخصص متوقف تجريبي",
        is_active: false,
      },
    ],
    doctors: [
      {
        id: 1,
        userId: 3,
        title: "Consultant",
        registration_number: "SYN100",
        specialtyIds: [1],
        created_at: NOW,
        updated_at: NOW,
      },
    ],
    schedules: new Map(),
    timeOff: [],
    fees: new Map(),
    patients: [
      {
        id: 1,
        full_name: "أحمد سامي تجريبي",
        sex: "male",
        date_of_birth: "1990-04-12",
        phone: "01000000001",
        national_id: "29004120100001",
        address: "12 Synthetic St, Cairo",
        emergency_contact: {
          name: "سامي تجريبي",
          relationship: "father",
          phone: "01000000009",
        },
        created_at: NOW,
        updated_at: NOW,
      },
      {
        id: 2,
        full_name: "Synthetic Patient Beta",
        sex: "female",
        date_of_birth: "1985-07-30",
        phone: "01000000002",
        national_id: null,
        address: null,
        emergency_contact: null,
        created_at: NOW,
        updated_at: NOW,
      },
      {
        id: 3,
        full_name: "Synthetic Child Gamma",
        sex: "male",
        date_of_birth: "2015-01-20",
        phone: "01000000002",
        national_id: null,
        address: null,
        emergency_contact: null,
        created_at: NOW,
        updated_at: NOW,
      },
      {
        id: 4,
        full_name: `Synthetic-${"Long".repeat(30)}-Name`,
        sex: "female",
        date_of_birth: "2000-02-29",
        phone: "01000000004",
        national_id: "30002290100004",
        address: `${"Long Synthetic Address ".repeat(15)}`.trim(),
        emergency_contact: null,
        created_at: NOW,
        updated_at: NOW,
      },
    ],
    patientOpenings: new Map(),
    appointments: [],
    queue: [],
    queueNumbers: new Map(),
  };
}

const PHONE = /^\+?[0-9]{8,15}$/;
const NATIONAL_ID = /^[23][0-9]{13}$/;
const normalizePhone = (value) =>
  typeof value === "string" ? value.replace(/[\s\-()]/gu, "") : value;
// A simple copy of the API's name matching, so that screens can be tested without the real API. The live
// tests prove the real thing.
const normalizeName = (value) =>
  value
    .toLowerCase()
    .replace(/[أإآ]/gu, "ا")
    .replace(/ة/gu, "ه")
    .replace(/ى/gu, "ي")
    .replace(/\s+/gu, " ")
    .trim();
const patientSummary = ({ id, full_name, sex, date_of_birth, phone }) => ({
  id,
  full_name,
  sex,
  date_of_birth,
  phone,
});
const PATIENT_FIELDS = [
  "full_name",
  "date_of_birth",
  "sex",
  "phone",
  "national_id",
  "address",
  "emergency_contact",
];

export function createClinic({ send, readJson, accounts, endSessions, port }) {
  let clinic = freshClinic();
  let nextId = 100;

  const refuse = (response, errors) =>
    send(response, 422, {
      message: Object.values(errors)[0][0],
      errors,
    });
  const forbid = (response) =>
    send(response, 403, {
      message: "You are not allowed to perform this action.",
    });
  const missing = (response) =>
    send(response, 404, { message: "Nothing was found." });

  const staff = (account) => {
    const copy = { ...account };
    delete copy.password;
    delete copy.hasProfile;
    return copy;
  };
  const accountOf = (doctor) =>
    accounts().find(({ id }) => id === doctor.userId);
  const specialtiesOf = (doctor) =>
    doctor.specialtyIds.map((id) =>
      clinic.specialties.find((specialty) => specialty.id === id),
    );
  const isActiveDoctor = (doctor) => {
    const account = accountOf(doctor);
    return account.is_active && account.role === "doctor";
  };
  const summary = (doctor) => ({
    id: doctor.id,
    name: accountOf(doctor).name,
    title: doctor.title,
    is_active: isActiveDoctor(doctor),
    specialties: specialtiesOf(doctor),
  });
  const full = (doctor) => ({
    ...summary(doctor),
    registration_number: doctor.registration_number,
    created_at: doctor.created_at,
    updated_at: doctor.updated_at,
  });
  const reference = (doctor) => ({
    id: doctor.id,
    name: accountOf(doctor).name,
    title: doctor.title,
  });
  const scheduleBody = (doctor) => {
    const saved = clinic.schedules.get(doctor.id);
    return {
      doctor_id: doctor.id,
      appointment_minutes: saved?.appointment_minutes ?? null,
      days: DAYS.map((day) => ({
        day,
        periods: (saved?.periods ?? [])
          .filter((period) => period.day === day)
          .sort((a, b) => minutes(a.start) - minutes(b.start))
          .map(({ start, end }) => ({ start, end })),
      })),
      updated_at: saved?.updated_at ?? null,
    };
  };
  const feeBody = (doctor) => {
    const saved = clinic.fees.get(doctor.id);
    return {
      doctor: reference(doctor),
      amount: saved?.amount ?? null,
      set_at: saved?.set_at ?? null,
      set_by: saved?.set_by ?? null,
    };
  };
  const timeOffBody = (entry) => ({ ...entry });

  function paginate(response, items, query, path) {
    const perPage = Number(query.get("per_page") ?? 15);
    const page = Number(query.get("page") ?? 1);
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(perPage) ||
      perPage < 1 ||
      perPage > 100
    ) {
      return refuse(response, { page: ["The page is not valid."] });
    }

    const lastPage = Math.max(1, Math.ceil(items.length / perPage));
    const rows = items.slice((page - 1) * perPage, page * perPage);
    const here = `http://127.0.0.1:${port}/api/v1/${path}`;
    return send(response, 200, {
      data: rows,
      links: {
        first: `${here}?page=1`,
        last: `${here}?page=${lastPage}`,
        prev: null,
        next: null,
      },
      meta: {
        current_page: page,
        from: rows.length ? (page - 1) * perPage + 1 : null,
        last_page: lastPage,
        links: [{ url: here, label: "1", page: 1, active: true }],
        path: here,
        per_page: perPage,
        to: rows.length ? (page - 1) * perPage + rows.length : null,
        total: items.length,
      },
    });
  }

  const readActiveFilter = (query) => {
    if (!query.has("is_active")) return { filter: () => true };
    const value = query.get("is_active");
    if (!["1", "0", "true", "false"].includes(value)) return { invalid: true };
    const wanted = value === "1" || value === "true";
    return { filter: (isActive) => isActive === wanted };
  };

  const admin = (handler) => (request, response, me, match, query) =>
    me.role === "administrator"
      ? handler(request, response, me, match, query)
      : forbid(response);

  const withStaff = (handler) =>
    admin((request, response, me, match, query) => {
      const account = accounts().find(({ id }) => id === Number(match[1]));
      return account
        ? handler(request, response, me, account, query)
        : missing(response);
    });

  const withDoctor = (handler) => (request, response, me, match, query) => {
    const doctor = clinic.doctors.find(({ id }) => id === Number(match[1]));
    return doctor
      ? handler(request, response, me, doctor, query, match)
      : missing(response);
  };

  const ownDoctor = (handler) => (request, response, me, _match, query) => {
    if (me.role !== "doctor") return forbid(response);
    let doctor = clinic.doctors.find(({ userId }) => userId === me.id);
    if (!doctor && me.hasProfile) {
      doctor = addDoctor(me.id, "Consultant", null, [1]);
    }
    return doctor
      ? handler(request, response, me, doctor, query)
      : missing(response);
  };

  function addDoctor(userId, title, registrationNumber, specialtyIds) {
    const doctor = {
      id: nextId++,
      userId,
      title,
      registration_number: registrationNumber,
      specialtyIds,
      created_at: NOW,
      updated_at: NOW,
    };
    clinic.doctors.push(doctor);
    const account = accounts().find(({ id }) => id === userId);
    if (account) account.hasProfile = true;
    return doctor;
  }

  const activeAdministrators = () =>
    accounts().filter(
      ({ role, is_active: active }) => role === "administrator" && active,
    );
  const isLastAdministrator = (account) =>
    account.role === "administrator" &&
    account.is_active &&
    activeAdministrators().length <= 1;
  const LAST_ADMINISTRATOR = {
    message: "This is the last active administrator.",
  };

  function slotsFor(doctor, from, to, { includeBooked = false } = {}) {
    const saved = clinic.schedules.get(doctor.id);
    if (!saved || !isActiveDoctor(doctor)) return [];

    const slots = [];
    for (let number = dayNumber(from); number <= dayNumber(to); number += 1) {
      const date = dateOf(number);
      const day = DAYS[new Date(number * 86_400_000).getUTCDay()];
      const wholeDayOff = clinic.timeOff.some(
        (entry) =>
          entry.doctor_id === doctor.id &&
          entry.start_time === null &&
          entry.start_date <= date &&
          entry.end_date >= date,
      );
      if (wholeDayOff) continue;

      const parts = clinic.timeOff.filter(
        (entry) =>
          entry.doctor_id === doctor.id &&
          entry.start_time !== null &&
          entry.start_date === date,
      );
      const periods = saved.periods
        .filter((period) => period.day === day)
        .sort((a, b) => minutes(a.start) - minutes(b.start));
      for (const period of periods) {
        for (
          let start = minutes(period.start);
          start + saved.appointment_minutes <= minutes(period.end);
          start += saved.appointment_minutes
        ) {
          const end = start + saved.appointment_minutes;
          const blocked = parts.some(
            (entry) =>
              minutes(entry.start_time) < end &&
              minutes(entry.end_time) > start,
          );
          const booked = clinic.appointments.some(
            (appointment) =>
              appointment.doctor_id === doctor.id &&
              overlaps(appointment, date, clock(start), clock(end)),
          );
          // As the API does: a time that has started is never on offer.
          const started = hasStarted({ date, start: clock(start) });
          if (!blocked && !started && (includeBooked || !booked)) {
            slots.push({ date, start: clock(start), end: clock(end) });
          }
        }
      }
    }
    return slots;
  }

  function checkSchedule({ appointment_minutes: length, periods }) {
    const errors = {};
    if (
      !Number.isInteger(length) ||
      length < 5 ||
      length > 240 ||
      length % 5 !== 0
    ) {
      errors.appointment_minutes = ["The appointment length is not valid."];
    }
    if (!Array.isArray(periods)) {
      errors.periods = ["The periods must be a list."];
      return errors;
    }
    periods.forEach((period, index) => {
      if (!DAYS.includes(period.day)) {
        errors[`periods.${index}.day`] = ["The day is not valid."];
      }
      if (!START.test(period.start ?? "")) {
        errors[`periods.${index}.start`] = ["The start time is not valid."];
      }
      if (!END.test(period.end ?? "")) {
        errors[`periods.${index}.end`] = ["The end time is not valid."];
      }
    });
    if (Object.keys(errors).length > 0) return errors;

    // The same order and keys as the backend's WeeklyScheduleRules.
    periods.forEach((period, index) => {
      const span = minutes(period.end) - minutes(period.start);
      if (span <= 0) {
        errors[`periods.${index}`] = ["The period must end after it starts."];
      } else if (length > span) {
        errors[`periods.${index}`] = [
          "The period is shorter than one appointment.",
        ];
      }
    });
    for (const day of DAYS) {
      const rows = periods
        .map((period, index) => ({ ...period, index }))
        .filter((period) => period.day === day)
        .sort((a, b) => minutes(a.start) - minutes(b.start));
      let previousEnd = null;
      rows.forEach((row, position) => {
        if (position === 4) {
          errors[`periods.${row.index}`] = [
            "A day can have at most 4 periods.",
          ];
        } else if (previousEnd !== null && minutes(row.start) <= previousEnd) {
          errors[`periods.${row.index}`] = ["The periods overlap."];
        }
        previousEnd = Math.max(previousEnd ?? 0, minutes(row.end));
      });
    }
    return errors;
  }

  function checkAmount(amount) {
    const text = String(amount ?? "");
    if (!AMOUNT.test(text)) return false;
    const [whole, decimals = ""] = text.split(".");
    const digits = whole.replace(/^0+/, "");
    const allZero = !digits && !/[1-9]/.test(decimals);
    const over =
      digits.length > 6 ||
      (digits.length === 6 && (digits !== "100000" || /[1-9]/.test(decimals)));
    return !allZero && !over;
  }

  function checkSpecialtyIds(ids, currentIds, errors) {
    if (!Array.isArray(ids) || ids.length === 0) {
      errors.specialty_ids = ["Choose at least one specialty."];
      return;
    }
    for (const id of ids) {
      const specialty = clinic.specialties.find((row) => row.id === id);
      if (!specialty) {
        errors["specialty_ids.0"] = ["The specialty does not exist."];
        return;
      }
      if (!specialty.is_active && !currentIds.includes(id)) {
        errors.specialty_ids = ["That specialty is deactivated."];
        return;
      }
    }
  }

  const readRange = (query) => ({
    from: query.get("from"),
    to: query.get("to"),
  });

  // Patients. Refusals use the keys in PatientRules and the patient form requests.
  const reception = (handler) => (request, response, me, match, query) =>
    me.role === "doctor"
      ? forbid(response)
      : handler(request, response, me, match, query);

  const withPatient = (handler) =>
    reception((request, response, me, match, query) => {
      const patient = clinic.patients.find(({ id }) => id === Number(match[1]));
      return patient
        ? handler(request, response, patient, query)
        : send(response, 404, { message: "No patient was found." });
    });

  function recordOpening(patient) {
    clinic.patientOpenings.set(
      patient.id,
      (clinic.patientOpenings.get(patient.id) ?? 0) + 1,
    );
  }

  function patientErrors(body, ignoreId, partial) {
    const errors = {};
    const has = (field) => !partial || Object.hasOwn(body, field);

    if (has("full_name") && !body.full_name) {
      errors.full_name = ["The full name is required."];
    }
    if (has("date_of_birth")) {
      if (!DATE.test(body.date_of_birth ?? "")) {
        errors.date_of_birth = ["The date of birth is not valid."];
      } else if (body.date_of_birth > clinicToday()) {
        errors.date_of_birth = ["The date of birth can't be in the future."];
      }
    }
    if (has("sex") && !["male", "female"].includes(body.sex)) {
      errors.sex = ["The sex is required."];
    }
    if (has("phone") && !PHONE.test(normalizePhone(body.phone) ?? "")) {
      errors.phone = ["The phone number is not valid."];
    }
    if (has("national_id") && body.national_id) {
      if (!NATIONAL_ID.test(body.national_id)) {
        errors.national_id = ["The national ID is not valid."];
      } else if (
        clinic.patients.some(
          ({ id, national_id: taken }) =>
            taken === body.national_id && id !== ignoreId,
        )
      ) {
        errors.national_id = ["This national ID has already been taken."];
      }
    }
    if (has("emergency_contact") && body.emergency_contact) {
      const contact = body.emergency_contact;
      if (!contact.name) {
        errors["emergency_contact.name"] = ["The contact's name is required."];
      }
      if (!contact.relationship) {
        errors["emergency_contact.relationship"] = [
          "The relationship is required.",
        ];
      }
      if (!PHONE.test(normalizePhone(contact.phone) ?? "")) {
        errors["emergency_contact.phone"] = [
          "The contact's phone is not valid.",
        ];
      }
    }
    return errors;
  }

  // Appointments. Refusals use the keys in BookingService, AppointmentService, and their form requests.
  const doctorOfAppointment = (appointment) =>
    clinic.doctors.find(({ id }) => id === appointment.doctor_id);
  const patientOfAppointment = (appointment) =>
    clinic.patients.find(({ id }) => id === appointment.patient_id);
  const appointmentSummary = (appointment) => {
    const patient = patientOfAppointment(appointment);
    return {
      id: appointment.id,
      date: appointment.date,
      start: appointment.start,
      end: appointment.end,
      status: appointment.status,
      outside_availability: appointment.outside_availability,
      doctor: reference(doctorOfAppointment(appointment)),
      patient: {
        id: patient.id,
        full_name: patient.full_name,
        phone: patient.phone,
      },
    };
  };
  const appointmentBody = (appointment) => ({
    ...appointmentSummary(appointment),
    note: appointment.note,
    booked_by: appointment.booked_by,
    booked_at: appointment.booked_at,
    rescheduled_by: appointment.rescheduled_by,
    rescheduled_at: appointment.rescheduled_at,
    status_changed_by: appointment.status_changed_by,
    status_changed_at: appointment.status_changed_at,
    cancellation_reason: appointment.cancellation_reason,
  });
  const ownSummary = (appointment) => {
    const patient = patientOfAppointment(appointment);
    return {
      id: appointment.id,
      date: appointment.date,
      start: appointment.start,
      end: appointment.end,
      status: appointment.status,
      outside_availability: appointment.outside_availability,
      patient: {
        id: patient.id,
        full_name: patient.full_name,
        sex: patient.sex,
        date_of_birth: patient.date_of_birth,
      },
    };
  };
  const hasStarted = ({ date, start }) =>
    `${date} ${start}` <= `${clinicToday()} ${clinicClock()}`;
  const overlaps = (a, date, start, end) =>
    a.status === "scheduled" &&
    a.date === date &&
    minutes(a.start) < minutes(end) &&
    minutes(a.end) > minutes(start);
  const staffRef = ({ id, name }) => ({ id, name });
  const LATER = "2026-02-02T10:00:00.000000Z";

  const withAppointment = (handler) =>
    reception((request, response, me, match, query) => {
      const appointment = clinic.appointments.find(
        ({ id }) => id === Number(match[1]),
      );
      return appointment
        ? handler(request, response, me, appointment, query)
        : send(response, 404, { message: "No appointment was found." });
    });

  function listRangeErrors(query) {
    const from = query.get("from");
    const to = query.get("to");
    if (!DATE.test(from ?? "")) {
      return { from: ["The from date is not valid."] };
    }
    if (!DATE.test(to ?? "") || to < from) {
      return { to: ["The to date is not valid."] };
    }
    if (dayNumber(to) - dayNumber(from) + 1 > 92) {
      return { to: ["The date range can be at most 92 days."] };
    }
    return null;
  }

  const inOrder = (a, b) =>
    a.date.localeCompare(b.date) ||
    a.start.localeCompare(b.start) ||
    a.id - b.id;

  function statusError(query) {
    const status = query.get("status");
    return status && !APPOINTMENT_STATUSES.includes(status)
      ? { status: ["The status is not valid."] }
      : null;
  }

  // The same order as the backend: is it an offered slot (422), then the doctor (409), then the patient (409).
  function refuseTime(response, doctor, patientId, date, start, exceptId) {
    const wrong = {};
    if (!DATE.test(date ?? "")) wrong.date = ["The date is not valid."];
    if (!START.test(start ?? "")) wrong.start = ["The start is not valid."];
    if (Object.keys(wrong).length > 0) {
      refuse(response, wrong);
      return null;
    }

    const notAvailable = { start: [SLOT_UNAVAILABLE] };
    if (
      date < clinicToday() ||
      dayNumber(date) > dayNumber(clinicToday()) + 90
    ) {
      refuse(response, notAvailable);
      return null;
    }
    const slot = slotsFor(doctor, date, date, { includeBooked: true }).find(
      (row) => row.start === start,
    );
    if (!slot) {
      refuse(response, notAvailable);
      return null;
    }

    const others = clinic.appointments.filter(({ id }) => id !== exceptId);
    if (
      others.some(
        (other) =>
          other.doctor_id === doctor.id &&
          overlaps(other, date, slot.start, slot.end),
      )
    ) {
      send(response, 409, {
        message: "This slot is already booked.",
        reason: "slot_booked",
      });
      return null;
    }
    if (
      others.some(
        (other) =>
          other.patient_id === patientId &&
          overlaps(other, date, slot.start, slot.end),
      )
    ) {
      send(response, 409, {
        message: "This patient already has an appointment at this time.",
        reason: "patient_busy",
      });
      return null;
    }
    return slot;
  }

  const NOT_CHANGEABLE = {
    appointment: ["This appointment can no longer be changed."],
  };

  // The queue. Refusals use the keys in QueueService and DoctorQueueService, and its order is the API's: each
  // booked patient by appointment start, each walk-in by arrival, then by number.
  const ENTRY_NOT_CHANGEABLE = {
    entry: ["This queue entry can no longer be changed."],
  };
  const orderMinute = (entry) =>
    entry.appointment_id === null
      ? entry.arrival_minute
      : minutes(
          clinic.appointments.find(({ id }) => id === entry.appointment_id)
            .start,
        );
  const inQueueOrder = (a, b) =>
    orderMinute(a) - orderMinute(b) || a.queue_number - b.queue_number;
  const queueBase = (entry) => {
    const appointment = clinic.appointments.find(
      ({ id }) => id === entry.appointment_id,
    );
    return {
      id: entry.id,
      queue_number: entry.queue_number,
      status: entry.status,
      walk_in: entry.appointment_id === null,
      arrived_at: entry.arrived_at,
      called_at: entry.called_at,
      finished_at: entry.finished_at,
      left_at: entry.left_at,
      appointment: appointment
        ? { id: appointment.id, start: appointment.start, end: appointment.end }
        : null,
    };
  };
  const queueBody = (entry) => {
    const patient = clinic.patients.find(({ id }) => id === entry.patient_id);
    return {
      ...queueBase(entry),
      doctor: reference(
        clinic.doctors.find(({ id }) => id === entry.doctor_id),
      ),
      patient: {
        id: patient.id,
        full_name: patient.full_name,
        phone: patient.phone,
      },
    };
  };
  const ownQueueBody = (entry) => {
    const patient = clinic.patients.find(({ id }) => id === entry.patient_id);
    return {
      ...queueBase(entry),
      patient: {
        id: patient.id,
        full_name: patient.full_name,
        sex: patient.sex,
        date_of_birth: patient.date_of_birth,
      },
    };
  };
  function addEntry({ doctorId, patientId, appointmentId = null, status }) {
    const number = (clinic.queueNumbers.get(doctorId) ?? 0) + 1;
    clinic.queueNumbers.set(doctorId, number);
    const entry = {
      id: nextId++,
      doctor_id: doctorId,
      patient_id: patientId,
      appointment_id: appointmentId,
      queue_number: number,
      status: status ?? "waiting",
      arrival_minute: minutes(clinicClock()),
      arrived_at: LATER,
      called_at: status === "with_doctor" || status === "seen" ? LATER : null,
      finished_at: status === "seen" ? LATER : null,
      left_at: status === "left" ? LATER : null,
    };
    clinic.queue.push(entry);
    return entry;
  }
  const withEntry = (handler) =>
    reception((request, response, me, match) => {
      const entry = clinic.queue.find(({ id }) => id === Number(match[1]));
      return entry
        ? handler(request, response, me, entry)
        : send(response, 404, { message: "No queue entry was found." });
    });

  const routes = [
    // Queue
    [
      "POST",
      /^appointments\/(\d+)\/check-in$/,
      withAppointment((_request, response, _me, appointment) => {
        if (
          appointment.status !== "scheduled" ||
          appointment.date !== clinicToday()
        ) {
          return refuse(response, {
            appointment: ["This appointment can't be checked in."],
          });
        }
        appointment.status = "checked_in";
        const entry = addEntry({
          doctorId: appointment.doctor_id,
          patientId: appointment.patient_id,
          appointmentId: appointment.id,
        });
        return send(response, 201, { data: queueBody(entry) });
      }),
    ],
    [
      "GET",
      /^queue$/,
      reception((_request, response, _me, _match, query) => {
        const status = query.get("status");
        if (
          status &&
          !["waiting", "with_doctor", "seen", "left"].includes(status)
        ) {
          return refuse(response, { status: ["The status is not valid."] });
        }
        const rows = clinic.queue
          .filter((entry) => !status || entry.status === status)
          .sort((a, b) => a.doctor_id - b.doctor_id || inQueueOrder(a, b))
          .map(queueBody);
        return paginate(response, rows, query, "queue");
      }),
    ],
    [
      "POST",
      /^queue\/walk-ins$/,
      reception(async (request, response) => {
        const body = await readJson(request);
        const doctor = clinic.doctors.find(({ id }) => id === body.doctor_id);
        if (!doctor) {
          return refuse(response, { doctor_id: ["No doctor was found."] });
        }
        if (!isActiveDoctor(doctor)) {
          return refuse(response, {
            doctor_id: ["This doctor is not active."],
          });
        }
        if (!clinic.patients.some(({ id }) => id === body.patient_id)) {
          return refuse(response, {
            patient_id: ["No patient was found with this patient number."],
          });
        }
        if (
          clinic.queue.some(
            (entry) =>
              entry.doctor_id === doctor.id &&
              entry.patient_id === body.patient_id &&
              ["waiting", "with_doctor"].includes(entry.status),
          )
        ) {
          return refuse(response, {
            patient_id: ["This patient is already in this doctor's queue."],
          });
        }
        const entry = addEntry({
          doctorId: doctor.id,
          patientId: body.patient_id,
        });
        return send(response, 201, { data: queueBody(entry) });
      }),
    ],
    [
      "POST",
      /^queue\/(\d+)\/leave$/,
      withEntry((_request, response, _me, entry) => {
        if (entry.status !== "waiting") {
          return refuse(response, ENTRY_NOT_CHANGEABLE);
        }
        entry.status = "left";
        entry.left_at = LATER;
        return send(response, 200, { data: queueBody(entry) });
      }),
    ],
    [
      "DELETE",
      /^queue\/(\d+)$/,
      withEntry((_request, response, _me, entry) => {
        if (entry.status !== "waiting" || entry.appointment_id === null) {
          return refuse(response, ENTRY_NOT_CHANGEABLE);
        }
        if (entry.has_active_charge) {
          return refuse(response, {
            entry: ["This visit has an active charge."],
          });
        }
        clinic.appointments.find(
          ({ id }) => id === entry.appointment_id,
        ).status = "scheduled";
        clinic.queue = clinic.queue.filter((row) => row !== entry);
        response.writeHead(204);
        return response.end();
      }),
    ],
    [
      "GET",
      /^doctors\/(\d+)\/queue$/,
      reception(
        withDoctor((_request, response, _me, doctor) =>
          send(response, 200, {
            data: clinic.queue
              .filter((entry) => entry.doctor_id === doctor.id)
              .sort(inQueueOrder)
              .map(queueBody),
          }),
        ),
      ),
    ],
    [
      "GET",
      /^doctors\/me\/queue$/,
      ownDoctor((_request, response, _me, doctor) =>
        send(response, 200, {
          data: clinic.queue
            .filter((entry) => entry.doctor_id === doctor.id)
            .sort(inQueueOrder)
            .map(ownQueueBody),
        }),
      ),
    ],
    [
      "POST",
      /^doctors\/me\/queue\/call-next$/,
      ownDoctor((_request, response, _me, doctor) => {
        const own = clinic.queue.filter(
          (entry) => entry.doctor_id === doctor.id,
        );
        if (own.some((entry) => entry.status === "with_doctor")) {
          return refuse(response, {
            queue: ["Finish the current visit first."],
          });
        }
        const next = own
          .filter((entry) => entry.status === "waiting")
          .sort(inQueueOrder)
          .find(
            (entry) =>
              !clinic.queue.some(
                (other) =>
                  other.patient_id === entry.patient_id &&
                  other.status === "with_doctor",
              ),
          );
        if (!next) {
          return refuse(response, { queue: ["Nobody is waiting."] });
        }
        next.status = "with_doctor";
        next.called_at = LATER;
        return send(response, 200, { data: ownQueueBody(next) });
      }),
    ],
    [
      "POST",
      /^doctors\/me\/queue\/finish$/,
      ownDoctor((_request, response, _me, doctor) => {
        const current = clinic.queue.find(
          (entry) =>
            entry.doctor_id === doctor.id && entry.status === "with_doctor",
        );
        if (!current) {
          return refuse(response, { queue: ["Nobody is with you."] });
        }
        if (current.appointment_id !== null) {
          clinic.appointments.find(
            ({ id }) => id === current.appointment_id,
          ).status = "completed";
        }
        current.status = "seen";
        current.finished_at = LATER;
        return send(response, 200, { data: ownQueueBody(current) });
      }),
    ],

    // Appointments
    [
      "GET",
      /^appointments$/,
      reception((_request, response, _me, _match, query) => {
        const errors = listRangeErrors(query) ?? statusError(query);
        if (errors) return refuse(response, errors);

        const doctor = query.get("doctor_id");
        const patient = query.get("patient_id");
        const status = query.get("status");
        const outside = query.get("outside_availability");
        if (patient && !/^[1-9]\d*$/.test(patient)) {
          return refuse(response, {
            patient_id: ["The patient number is not valid."],
          });
        }
        const rows = clinic.appointments
          .filter(
            (row) =>
              row.date >= query.get("from") &&
              row.date <= query.get("to") &&
              (!doctor || row.doctor_id === Number(doctor)) &&
              (!patient || row.patient_id === Number(patient)) &&
              (!status || row.status === status) &&
              (outside === null ||
                row.outside_availability === (outside === "1")),
          )
          .sort(inOrder)
          .map(appointmentSummary);
        return paginate(response, rows, query, "appointments");
      }),
    ],
    [
      "POST",
      /^appointments$/,
      reception(async (request, response, me) => {
        const body = await readJson(request);
        const errors = {};
        if (!Number.isInteger(body.patient_id)) {
          errors.patient_id = ["The patient number is required."];
        }
        if (!Number.isInteger(body.doctor_id)) {
          errors.doctor_id = ["The doctor is required."];
        }
        if (typeof body.note === "string" && body.note.length > 500) {
          errors.note = ["The note can be at most 500 characters."];
        }
        if (Object.keys(errors).length > 0) return refuse(response, errors);

        const patient = clinic.patients.find(
          ({ id }) => id === body.patient_id,
        );
        if (!patient) {
          return refuse(response, {
            patient_id: ["No patient was found with this patient number."],
          });
        }
        const doctor = clinic.doctors.find(({ id }) => id === body.doctor_id);
        if (!doctor) {
          return refuse(response, { doctor_id: ["No doctor was found."] });
        }
        const slot = refuseTime(
          response,
          doctor,
          patient.id,
          body.date,
          body.start,
        );
        if (!slot) return undefined;

        const appointment = {
          id: nextId++,
          doctor_id: doctor.id,
          patient_id: patient.id,
          date: body.date,
          start: slot.start,
          end: slot.end,
          status: "scheduled",
          outside_availability: false,
          note: body.note ?? null,
          booked_by: staffRef(me),
          booked_at: NOW,
          rescheduled_by: null,
          rescheduled_at: null,
          status_changed_by: null,
          status_changed_at: null,
          cancellation_reason: null,
        };
        clinic.appointments.push(appointment);
        return send(response, 201, { data: appointmentBody(appointment) });
      }),
    ],
    [
      "GET",
      /^appointments\/(\d+)$/,
      withAppointment((_request, response, _me, appointment) =>
        send(response, 200, { data: appointmentBody(appointment) }),
      ),
    ],
    [
      "POST",
      /^appointments\/(\d+)\/reschedule$/,
      withAppointment(async (request, response, me, appointment) => {
        const body = await readJson(request);
        if (appointment.status !== "scheduled" || hasStarted(appointment)) {
          return refuse(response, NOT_CHANGEABLE);
        }
        const slot = refuseTime(
          response,
          doctorOfAppointment(appointment),
          appointment.patient_id,
          body.date,
          body.start,
          appointment.id,
        );
        if (!slot) return undefined;

        appointment.date = body.date;
        appointment.start = slot.start;
        appointment.end = slot.end;
        appointment.outside_availability = false;
        appointment.rescheduled_by = staffRef(me);
        appointment.rescheduled_at = LATER;
        return send(response, 200, { data: appointmentBody(appointment) });
      }),
    ],
    [
      "POST",
      /^appointments\/(\d+)\/cancel$/,
      withAppointment(async (request, response, me, appointment) => {
        const body = await readJson(request);
        if (typeof body.reason === "string" && body.reason.length > 255) {
          return refuse(response, {
            reason: ["The reason can be at most 255 characters."],
          });
        }
        if (appointment.status !== "scheduled" || hasStarted(appointment)) {
          return refuse(response, NOT_CHANGEABLE);
        }
        appointment.status = "cancelled";
        appointment.outside_availability = false;
        appointment.status_changed_by = staffRef(me);
        appointment.status_changed_at = LATER;
        appointment.cancellation_reason = body.reason ?? null;
        return send(response, 200, { data: appointmentBody(appointment) });
      }),
    ],
    [
      "POST",
      /^appointments\/(\d+)\/no-show$/,
      withAppointment((_request, response, me, appointment) => {
        if (appointment.status !== "scheduled") {
          return refuse(response, NOT_CHANGEABLE);
        }
        if (!hasStarted(appointment)) {
          return refuse(response, {
            appointment: ["This appointment has not started yet."],
          });
        }
        appointment.status = "no_show";
        appointment.status_changed_by = staffRef(me);
        appointment.status_changed_at = LATER;
        return send(response, 200, { data: appointmentBody(appointment) });
      }),
    ],
    [
      "GET",
      /^doctors\/me\/appointments$/,
      ownDoctor((_request, response, _me, doctor, query) => {
        const errors = listRangeErrors(query) ?? statusError(query);
        if (errors) return refuse(response, errors);

        const status = query.get("status");
        const rows = clinic.appointments
          .filter(
            (row) =>
              row.doctor_id === doctor.id &&
              row.date >= query.get("from") &&
              row.date <= query.get("to") &&
              (!status || row.status === status),
          )
          .sort(inOrder)
          .map(ownSummary);
        return paginate(response, rows, query, "doctors/me/appointments");
      }),
    ],
    [
      "GET",
      /^doctors\/me\/appointments\/(\d+)$/,
      (request, response, me, match, query) =>
        ownDoctor((_request, innerResponse, _me, doctor) => {
          const appointment = clinic.appointments.find(
            (row) => row.id === Number(match[1]) && row.doctor_id === doctor.id,
          );
          return appointment
            ? send(innerResponse, 200, {
                data: {
                  ...ownSummary(appointment),
                  note: appointment.note,
                  booked_at: appointment.booked_at,
                },
              })
            : send(innerResponse, 404, {
                message: "No appointment was found.",
              });
        })(request, response, me, match, query),
    ],
    [
      "GET",
      /^patients$/,
      reception((_request, response, _me, _match, query) => {
        const name = query.get("name");
        const phone = query.get("phone");
        const nationalId = query.get("national_id");
        const id = query.get("id");

        if (phone && !PHONE.test(normalizePhone(phone))) {
          return refuse(response, {
            phone: ["The phone number is not valid."],
          });
        }
        if (nationalId && !NATIONAL_ID.test(nationalId)) {
          return refuse(response, {
            national_id: ["The national ID is not valid."],
          });
        }
        if (id && !/^[1-9]\d*$/.test(id)) {
          return refuse(response, { id: ["The patient number is not valid."] });
        }

        const rows = clinic.patients
          .filter(
            (patient) =>
              (!name ||
                normalizeName(patient.full_name).includes(
                  normalizeName(name),
                )) &&
              (!phone || patient.phone === normalizePhone(phone)) &&
              (!nationalId || patient.national_id === nationalId) &&
              (!id || patient.id === Number(id)),
          )
          .map(patientSummary);
        return paginate(response, rows, query, "patients");
      }),
    ],
    [
      "POST",
      /^patients$/,
      reception(async (request, response) => {
        const body = await readJson(request);
        const errors = patientErrors(body, null, false);
        if (Object.keys(errors).length > 0) return refuse(response, errors);

        const patient = {
          id: nextId++,
          full_name: body.full_name,
          sex: body.sex,
          date_of_birth: body.date_of_birth,
          phone: normalizePhone(body.phone),
          national_id: body.national_id ?? null,
          address: body.address ?? null,
          emergency_contact: body.emergency_contact ?? null,
          created_at: NOW,
          updated_at: NOW,
        };
        clinic.patients.push(patient);
        return send(response, 201, { data: patient });
      }),
    ],
    [
      "GET",
      /^patients\/(\d+)$/,
      withPatient((_request, response, patient) => {
        recordOpening(patient);
        return send(response, 200, { data: patient });
      }),
    ],
    [
      "PATCH",
      /^patients\/(\d+)$/,
      withPatient(async (request, response, patient) => {
        const body = await readJson(request);
        if (!PATIENT_FIELDS.some((field) => Object.hasOwn(body, field))) {
          return refuse(response, {
            fields: ["Send at least one detail to change."],
          });
        }
        const errors = patientErrors(body, patient.id, true);
        if (Object.keys(errors).length > 0) return refuse(response, errors);

        let changed = false;
        for (const field of PATIENT_FIELDS) {
          if (!Object.hasOwn(body, field)) continue;
          const value =
            field === "phone" ? normalizePhone(body[field]) : body[field];
          if (JSON.stringify(patient[field]) !== JSON.stringify(value)) {
            patient[field] = value;
            changed = true;
          }
        }
        // As the real API does: the whole record comes back, so this counts as reading it.
        if (changed) patient.updated_at = "2026-03-01T10:00:00.000000Z";
        else recordOpening(patient);
        return send(response, 200, { data: patient });
      }),
    ],
    // Staff
    [
      "GET",
      /^staff$/,
      admin((_request, response, _me, _match, query) => {
        const role = query.get("role");
        if (
          role !== null &&
          !["administrator", "receptionist", "doctor"].includes(role)
        ) {
          return refuse(response, { role: ["The role is not valid."] });
        }
        const active = readActiveFilter(query);
        if (active.invalid) {
          return refuse(response, { is_active: ["The status is not valid."] });
        }
        const rows = accounts()
          .filter(
            (account) =>
              (role === null || account.role === role) &&
              active.filter(account.is_active),
          )
          .map(staff);
        return paginate(response, rows, query, "staff");
      }),
    ],
    [
      "POST",
      /^staff$/,
      admin(async (request, response) => {
        const body = await readJson(request);
        const errors = {};
        if (!body.name) errors.name = ["The name is required."];
        if (!body.email) errors.email = ["The email is required."];
        else if (accounts().some(({ email }) => email === body.email)) {
          errors.email = ["That email is already in use."];
        }
        if (!body.role) errors.role = ["The role is required."];
        if ((body.password ?? "").length < 12) {
          errors.password = ["The password must be at least 12 characters."];
        } else if (body.password !== body.password_confirmation) {
          errors.password = ["The password confirmation does not match."];
        }
        if (Object.keys(errors).length > 0) return refuse(response, errors);

        const account = {
          id: nextId++,
          name: body.name,
          email: body.email,
          role: body.role,
          is_active: true,
          password: body.password,
          hasProfile: false,
          created_at: "2026-02-01T10:00:00+00:00",
          updated_at: "2026-02-01T10:00:00+00:00",
        };
        accounts().push(account);
        return send(response, 201, { data: staff(account) });
      }),
    ],
    [
      "GET",
      /^staff\/(\d+)$/,
      withStaff((_request, response, _me, account) =>
        send(response, 200, { data: staff(account) }),
      ),
    ],
    [
      "PATCH",
      /^staff\/(\d+)$/,
      withStaff(async (request, response, _me, account) => {
        const body = await readJson(request);
        const errors = {};
        if (
          body.email !== undefined &&
          accounts().some(
            ({ email, id }) => email === body.email && id !== account.id,
          )
        ) {
          errors.email = ["That email is already in use."];
        }
        if (body.name !== undefined && !body.name) {
          errors.name = ["The name is required."];
        }
        if (Object.keys(errors).length > 0) return refuse(response, errors);
        if (
          body.role !== undefined &&
          body.role !== "administrator" &&
          isLastAdministrator(account)
        ) {
          return send(response, 422, LAST_ADMINISTRATOR);
        }
        for (const field of ["name", "email", "role"]) {
          if (body[field] !== undefined) account[field] = body[field];
        }
        return send(response, 200, { data: staff(account) });
      }),
    ],
    [
      "POST",
      /^staff\/(\d+)\/deactivate$/,
      withStaff((_request, response, _me, account) => {
        if (isLastAdministrator(account)) {
          return send(response, 422, LAST_ADMINISTRATOR);
        }
        account.is_active = false;
        endSessions(account.id);
        return send(response, 200, { data: staff(account) });
      }),
    ],
    [
      "POST",
      /^staff\/(\d+)\/reactivate$/,
      withStaff((_request, response, _me, account) => {
        account.is_active = true;
        return send(response, 200, { data: staff(account) });
      }),
    ],
    [
      "PUT",
      /^staff\/(\d+)\/password$/,
      withStaff(async (request, response, _me, account) => {
        const body = await readJson(request);
        if ((body.password ?? "").length < 12) {
          return refuse(response, {
            password: ["The password must be at least 12 characters."],
          });
        }
        if (body.password !== body.password_confirmation) {
          return refuse(response, {
            password: ["The password confirmation does not match."],
          });
        }
        account.password = body.password;
        endSessions(account.id);
        response.writeHead(204);
        return response.end();
      }),
    ],

    // Specialties
    [
      "GET",
      /^specialties$/,
      (_request, response, _me, _match, query) => {
        const active = readActiveFilter(query);
        if (active.invalid) {
          return refuse(response, { is_active: ["The status is not valid."] });
        }
        return send(response, 200, {
          data: clinic.specialties.filter(({ is_active: isActive }) =>
            active.filter(isActive),
          ),
        });
      },
    ],
    [
      "POST",
      /^specialties$/,
      admin(async (request, response) => {
        const body = await readJson(request);
        const errors = checkSpecialty(body, null, true);
        if (Object.keys(errors).length > 0) return refuse(response, errors);
        const specialty = {
          id: nextId++,
          name_en: body.name_en,
          name_ar: body.name_ar,
          is_active: true,
        };
        clinic.specialties.push(specialty);
        return send(response, 201, { data: specialty });
      }),
    ],
    [
      "PATCH",
      /^specialties\/(\d+)$/,
      admin(async (request, response, _me, match) => {
        const specialty = clinic.specialties.find(
          ({ id }) => id === Number(match[1]),
        );
        if (!specialty) return missing(response);
        const body = await readJson(request);
        if (body.name_en === undefined && body.name_ar === undefined) {
          return send(response, 422, {
            message: "There is nothing to update.",
          });
        }
        const errors = checkSpecialty(body, specialty.id, false);
        if (Object.keys(errors).length > 0) return refuse(response, errors);
        Object.assign(specialty, body);
        return send(response, 200, { data: specialty });
      }),
    ],
    [
      "POST",
      /^specialties\/(\d+)\/(deactivate|reactivate)$/,
      admin((_request, response, _me, match) => {
        const specialty = clinic.specialties.find(
          ({ id }) => id === Number(match[1]),
        );
        if (!specialty) return missing(response);
        specialty.is_active = match[2] === "reactivate";
        return send(response, 200, { data: specialty });
      }),
    ],

    // Doctors
    [
      "GET",
      /^doctors$/,
      (_request, response, _me, _match, query) => {
        const active = readActiveFilter(query);
        if (active.invalid) {
          return refuse(response, { is_active: ["The status is not valid."] });
        }
        const name = (query.get("name") ?? "").toLowerCase();
        const specialty = query.get("specialty_id");
        const rows = clinic.doctors
          .map(summary)
          .filter(
            (doctor) =>
              doctor.name.toLowerCase().includes(name) &&
              active.filter(doctor.is_active) &&
              (specialty === null ||
                doctor.specialties.some(({ id }) => id === Number(specialty))),
          );
        return paginate(response, rows, query, "doctors");
      },
    ],
    [
      "POST",
      /^doctors$/,
      admin(async (request, response) => {
        const body = await readJson(request);
        const errors = {};
        const account = accounts().find(({ id }) => id === body.user_id);
        if (!account || !account.is_active || account.role !== "doctor") {
          errors.user_id = ["That account can't have a doctor profile."];
        } else if (clinic.doctors.some(({ userId }) => userId === account.id)) {
          errors.user_id = ["That account already has a doctor profile."];
        }
        if (!body.title) errors.title = ["The title is required."];
        if (
          body.registration_number !== undefined &&
          body.registration_number !== null
        ) {
          if (!REGISTRATION.test(body.registration_number)) {
            errors.registration_number = [
              "The registration number is not valid.",
            ];
          } else if (
            clinic.doctors.some(
              ({ registration_number: number }) =>
                number === body.registration_number,
            )
          ) {
            errors.registration_number = [
              "That registration number is already taken.",
            ];
          }
        }
        checkSpecialtyIds(body.specialty_ids, [], errors);
        if (Object.keys(errors).length > 0) return refuse(response, errors);

        const doctor = addDoctor(
          body.user_id,
          body.title,
          body.registration_number ?? null,
          body.specialty_ids,
        );
        return send(response, 201, { data: full(doctor) });
      }),
    ],
    [
      "GET",
      /^doctors\/(\d+)$/,
      withDoctor((_request, response, _me, doctor) =>
        send(response, 200, { data: full(doctor) }),
      ),
    ],
    [
      "PATCH",
      /^doctors\/(\d+)$/,
      admin(
        withDoctor(async (request, response, _me, doctor) => {
          const body = await readJson(request);
          const errors = {};
          if (body.title !== undefined && !body.title) {
            errors.title = ["The title is required."];
          }
          if (
            body.registration_number !== undefined &&
            body.registration_number !== null
          ) {
            if (!REGISTRATION.test(body.registration_number)) {
              errors.registration_number = [
                "The registration number is not valid.",
              ];
            } else if (
              clinic.doctors.some(
                (other) =>
                  other.id !== doctor.id &&
                  other.registration_number === body.registration_number,
              )
            ) {
              errors.registration_number = [
                "That registration number is already taken.",
              ];
            }
          }
          if (body.specialty_ids !== undefined) {
            checkSpecialtyIds(body.specialty_ids, doctor.specialtyIds, errors);
          }
          if (Object.keys(errors).length > 0) return refuse(response, errors);

          if (body.title !== undefined) doctor.title = body.title;
          if (body.registration_number !== undefined) {
            doctor.registration_number = body.registration_number;
          }
          if (body.specialty_ids !== undefined) {
            doctor.specialtyIds = body.specialty_ids;
          }
          return send(response, 200, { data: full(doctor) });
        }),
      ),
    ],

    // Scheduling
    [
      "GET",
      /^doctors\/(\d+)\/schedule$/,
      withDoctor((_request, response, _me, doctor) =>
        send(response, 200, { data: scheduleBody(doctor) }),
      ),
    ],
    [
      "PUT",
      /^doctors\/(\d+)\/schedule$/,
      admin(
        withDoctor(async (request, response, _me, doctor) => {
          const body = await readJson(request);
          const errors = checkSchedule(body);
          if (Object.keys(errors).length > 0) return refuse(response, errors);
          clinic.schedules.set(doctor.id, {
            appointment_minutes: body.appointment_minutes,
            periods: body.periods,
            updated_at: NOW,
          });
          return send(response, 200, { data: scheduleBody(doctor) });
        }),
      ),
    ],
    [
      "DELETE",
      /^doctors\/(\d+)\/schedule$/,
      admin(
        withDoctor((_request, response, _me, doctor) => {
          clinic.schedules.delete(doctor.id);
          response.writeHead(204);
          return response.end();
        }),
      ),
    ],
    [
      "GET",
      /^doctors\/(\d+)\/slots$/,
      withDoctor((_request, response, _me, doctor, query) =>
        sendSlots(response, doctor, query),
      ),
    ],
    [
      "GET",
      /^doctors\/(\d+)\/time-off$/,
      withDoctor((_request, response, _me, doctor, query) =>
        sendTimeOff(response, doctor, query),
      ),
    ],
    [
      "POST",
      /^doctors\/(\d+)\/time-off$/,
      admin(
        withDoctor(async (request, response, _me, doctor) => {
          const body = await readJson(request);
          const errors = {};
          if (!DATE.test(body.start_date ?? "")) {
            errors.start_date = ["The start date is required."];
          } else if (body.start_date < clinicToday()) {
            errors.start_date = ["The start date can't be in the past."];
          }
          if (!DATE.test(body.end_date ?? "")) {
            errors.end_date = ["The end date is required."];
          } else if (body.end_date < body.start_date) {
            errors.end_date = ["The end date can't be before the start."];
          }
          if (Object.keys(errors).length === 0 && body.start_time) {
            if (body.start_date !== body.end_date) {
              errors.start_time = ["Times are only for a single day."];
            } else if (minutes(body.end_time) <= minutes(body.start_time)) {
              errors.end_time = ["The end must be after the start."];
            }
          }
          if (Object.keys(errors).length > 0) return refuse(response, errors);

          const entry = addTimeOff(doctor.id, body);
          return send(response, 201, { data: timeOffBody(entry) });
        }),
      ),
    ],
    [
      "DELETE",
      /^doctors\/(\d+)\/time-off\/(\d+)$/,
      admin(
        withDoctor((_request, response, _me, doctor, _query, match) => {
          const entry = clinic.timeOff.find(
            ({ id, doctor_id: doctorId }) =>
              id === Number(match[2]) && doctorId === doctor.id,
          );
          if (!entry) return missing(response);
          const today = clinicToday();
          const ended =
            entry.end_date < today ||
            (entry.end_date === today &&
              entry.end_time !== null &&
              entry.end_time <= clinicClock());
          if (ended) {
            return refuse(response, {
              time_off: ["This time off has already ended."],
            });
          }
          clinic.timeOff = clinic.timeOff.filter((row) => row !== entry);
          response.writeHead(204);
          return response.end();
        }),
      ),
    ],
    [
      "GET",
      /^doctors\/me\/schedule$/,
      ownDoctor((_request, response, _me, doctor) =>
        send(response, 200, { data: scheduleBody(doctor) }),
      ),
    ],
    [
      "GET",
      /^doctors\/me\/slots$/,
      ownDoctor((_request, response, _me, doctor, query) =>
        sendSlots(response, doctor, query),
      ),
    ],
    [
      "GET",
      /^doctors\/me\/time-off$/,
      ownDoctor((_request, response, _me, doctor, query) =>
        sendTimeOff(response, doctor, query),
      ),
    ],

    // Fees
    [
      "GET",
      /^fees$/,
      (_request, response, me, _match, query) =>
        me.role === "doctor"
          ? forbid(response)
          : paginate(response, clinic.doctors.map(feeBody), query, "fees"),
    ],
    [
      "GET",
      /^doctors\/(\d+)\/fee$/,
      (request, response, me, match, query) =>
        me.role === "doctor"
          ? forbid(response)
          : withDoctor((_request, res, _me, doctor) =>
              send(res, 200, { data: feeBody(doctor) }),
            )(request, response, me, match, query),
    ],
    [
      "PUT",
      /^doctors\/(\d+)\/fee$/,
      admin(
        withDoctor(async (request, response, me, doctor) => {
          const body = await readJson(request);
          if (!checkAmount(body.amount)) {
            return refuse(response, { amount: ["The amount is not valid."] });
          }
          const [whole, decimals = ""] = String(body.amount).split(".");
          clinic.fees.set(doctor.id, {
            amount: `${whole.replace(/^0+(?=\d)/, "")}.${decimals.padEnd(2, "0")}`,
            set_at: NOW,
            set_by: { id: me.id, name: me.name },
          });
          return send(response, 200, { data: feeBody(doctor) });
        }),
      ),
    ],
  ];

  function checkSpecialty(body, ownId, required) {
    const errors = {};
    for (const field of ["name_en", "name_ar"]) {
      const value = body[field];
      if (value === undefined && !required) continue;
      if (!value) errors[field] = ["The name is required."];
      else if (
        clinic.specialties.some(
          (specialty) =>
            specialty.id !== ownId &&
            specialty[field].toLowerCase() === value.toLowerCase(),
        )
      ) {
        errors[field] = ["That name is already used."];
      }
    }
    return errors;
  }

  function sendSlots(response, doctor, query) {
    const { from, to } = readRange(query);
    if (!DATE.test(from ?? "") || from < clinicToday()) {
      return refuse(response, { from: ["The first date is not valid."] });
    }
    if (!DATE.test(to ?? "") || to < from) {
      return refuse(response, { to: ["The last date is not valid."] });
    }
    if (dayNumber(to) - dayNumber(from) + 1 > 31) {
      return refuse(response, { to: ["The range can be at most 31 days."] });
    }
    return send(response, 200, { data: slotsFor(doctor, from, to) });
  }

  function sendTimeOff(response, doctor, query) {
    const { from, to } = readRange(query);
    if (!DATE.test(from ?? "")) {
      return refuse(response, { from: ["The first date is not valid."] });
    }
    if (!DATE.test(to ?? "") || to < from) {
      return refuse(response, { to: ["The last date is not valid."] });
    }
    if (dayNumber(to) - dayNumber(from) > 366) {
      return refuse(response, { to: ["The range can be at most 366 days."] });
    }
    return send(response, 200, {
      data: clinic.timeOff
        .filter(
          (entry) =>
            entry.doctor_id === doctor.id &&
            entry.start_date <= to &&
            entry.end_date >= from,
        )
        .sort((a, b) => a.start_date.localeCompare(b.start_date))
        .map(timeOffBody),
    });
  }

  function addTimeOff(doctorId, values) {
    const entry = {
      id: nextId++,
      doctor_id: doctorId,
      start_date: values.start_date,
      end_date: values.end_date,
      start_time: values.start_time || null,
      end_time: values.end_time || null,
      reason: values.reason || null,
      created_at: NOW,
    };
    clinic.timeOff.push(entry);
    return entry;
  }

  const WORKING_WEEK = DAYS.map((day) => ({
    day,
    start: "09:00",
    end: "13:00",
  }));

  // Sets up a state directly, for tests that aren't about reaching it through the screens.
  function control(pathname, query, response) {
    switch (pathname) {
      case "/__control/clinic/setup": {
        const doctor = clinic.doctors.find(
          ({ id }) => id === Number(query.get("doctor") ?? 1),
        );
        if (query.get("schedule") === "1") {
          clinic.schedules.set(doctor.id, {
            appointment_minutes: 20,
            periods: WORKING_WEEK,
            updated_at: NOW,
          });
        }
        if (query.has("fee")) {
          clinic.fees.set(doctor.id, {
            amount: query.get("fee"),
            set_at: NOW,
            set_by: { id: 1, name: "Synthetic Admin" },
          });
        }
        send(response, 200, {});
        return true;
      }
      case "/__control/clinic/second-doctor": {
        const doctor = addDoctor(4, "Specialist", null, [2]);
        clinic.schedules.set(doctor.id, {
          appointment_minutes: 20,
          periods: WORKING_WEEK,
          updated_at: NOW,
        });
        send(response, 200, { id: doctor.id });
        return true;
      }
      case "/__control/clinic/appointment": {
        const start = query.get("start") ?? "09:00";
        const days = Number(query.get("days") ?? 1);
        const status = query.get("status") ?? "scheduled";
        const changed = status !== "scheduled";
        const appointment = {
          id: nextId++,
          doctor_id: Number(query.get("doctor") ?? 1),
          patient_id: Number(query.get("patient") ?? 2),
          date: dateOf(dayNumber(clinicToday()) + days),
          start,
          end: query.get("end") ?? clock(minutes(start) + 20),
          status,
          outside_availability: query.get("outside") === "1",
          note: query.get("note"),
          booked_by:
            query.get("no_booker") === "1"
              ? null
              : { id: 2, name: "Synthetic Reception" },
          booked_at: NOW,
          rescheduled_by: null,
          rescheduled_at: null,
          status_changed_by: changed
            ? { id: 2, name: "Synthetic Reception" }
            : null,
          status_changed_at: changed ? LATER : null,
          cancellation_reason: query.get("reason"),
        };
        clinic.appointments.push(appointment);
        send(response, 200, {
          id: appointment.id,
          date: appointment.date,
          start: appointment.start,
        });
        return true;
      }
      case "/__control/clinic/queue-entry": {
        // An entry already on a list, for tests that aren't about how it got there. With `start`, it comes from
        // an appointment today at that time. Otherwise it's a walk-in.
        const doctorId = Number(query.get("doctor") ?? 1);
        const patientId = Number(query.get("patient") ?? 2);
        const status = query.get("status") ?? "waiting";
        let appointmentId = null;
        if (query.has("start")) {
          const start = query.get("start");
          const appointment = {
            id: nextId++,
            doctor_id: doctorId,
            patient_id: patientId,
            date: clinicToday(),
            start,
            end: clock(minutes(start) + 20),
            status: "checked_in",
            outside_availability: false,
            note: null,
            booked_by: { id: 2, name: "Synthetic Reception" },
            booked_at: NOW,
            rescheduled_by: null,
            rescheduled_at: null,
            status_changed_by: null,
            status_changed_at: null,
            cancellation_reason: null,
          };
          clinic.appointments.push(appointment);
          appointmentId = appointment.id;
        }
        const entry = addEntry({ doctorId, patientId, appointmentId, status });
        send(response, 200, { id: entry.id, appointmentId });
        return true;
      }
      case "/__control/clinic/change-entry": {
        // Someone else acts on another computer, after this screen has read the list.
        const entry = clinic.queue.find(
          ({ id }) => id === Number(query.get("id")),
        );
        if (query.get("remove") === "1") {
          clinic.queue = clinic.queue.filter((row) => row !== entry);
        }
        if (query.has("status")) entry.status = query.get("status");
        if (query.get("charge") === "1") entry.has_active_charge = true;
        send(response, 200, {});
        return true;
      }
      case "/__control/clinic/take-time": {
        // Someone else takes this time, after the screen has read the free times.
        const start = query.get("start");
        clinic.appointments.push({
          id: nextId++,
          doctor_id: Number(query.get("doctor") ?? 1),
          patient_id: Number(query.get("patient") ?? 3),
          date: query.get("date"),
          start,
          end: clock(minutes(start) + 20),
          status: "scheduled",
          outside_availability: false,
          note: null,
          booked_by: { id: 2, name: "Synthetic Reception" },
          booked_at: NOW,
          rescheduled_by: null,
          rescheduled_at: null,
          status_changed_by: null,
          status_changed_at: null,
          cancellation_reason: null,
        });
        send(response, 200, {});
        return true;
      }
      case "/__control/clinic/change-appointment": {
        const appointment = clinic.appointments.find(
          ({ id }) => id === Number(query.get("id")),
        );
        appointment.status = query.get("status");
        send(response, 200, {});
        return true;
      }
      case "/__control/clinic/more-staff": {
        for (let index = 0; index < Number(query.get("count")); index += 1) {
          const id = nextId++;
          accounts().push({
            id,
            name: `Synthetic Extra ${id}`,
            email: `synthetic.extra.${id}@example.test`,
            role: "doctor",
            is_active: true,
            password: "synthetic-password-1",
            hasProfile: false,
            created_at: "2026-02-01T10:00:00+00:00",
            updated_at: "2026-02-01T10:00:00+00:00",
          });
        }
        send(response, 200, {});
        return true;
      }
      case "/__control/clinic/time-off": {
        addTimeOff(Number(query.get("doctor") ?? 1), {
          start_date: query.get("start"),
          end_date: query.get("end") ?? query.get("start"),
          start_time: query.get("start_time"),
          end_time: query.get("end_time"),
          reason: query.get("reason"),
        });
        send(response, 200, {});
        return true;
      }
      case "/__control/clinic/patient-openings": {
        send(response, 200, {
          count: clinic.patientOpenings.get(Number(query.get("id"))) ?? 0,
        });
        return true;
      }
      case "/__control/clinic/more-patients": {
        for (let index = 0; index < Number(query.get("count")); index += 1) {
          const id = nextId++;
          clinic.patients.push({
            id,
            full_name: `Synthetic Crowd ${id}`,
            sex: "female",
            date_of_birth: "1990-01-01",
            phone: "01000000077",
            national_id: null,
            address: null,
            emergency_contact: null,
            created_at: NOW,
            updated_at: NOW,
          });
        }
        send(response, 200, {});
        return true;
      }
      case "/__control/clinic/empty": {
        if (query.get("what") === "specialties") clinic.specialties = [];
        if (query.get("what") === "active-specialties") {
          for (const row of clinic.specialties) row.is_active = false;
        }
        if (query.get("what") === "doctors") clinic.doctors = [];
        send(response, 200, {});
        return true;
      }
      default:
        return false;
    }
  }

  return {
    routes,
    control,
    reset() {
      clinic = freshClinic();
      nextId = 100;
    },
  };
}
