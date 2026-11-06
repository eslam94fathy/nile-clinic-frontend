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
  };
}

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

  const admin =
    (handler) =>
    (request, response, me, match, query) =>
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

  function slotsFor(doctor, from, to) {
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
          if (!blocked) {
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
          errors[`periods.${row.index}`] = ["A day can have at most 4 periods."];
        } else if (
          previousEnd !== null &&
          minutes(row.start) <= previousEnd
        ) {
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
      (digits.length === 6 &&
        (digits !== "100000" || /[1-9]/.test(decimals)));
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

  const routes = [
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
          return send(response, 422, { message: "There is nothing to update." });
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
                doctor.specialties.some(
                  ({ id }) => id === Number(specialty),
                )),
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
            checkSpecialtyIds(
              body.specialty_ids,
              doctor.specialtyIds,
              errors,
            );
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
