type WithDoctor = { doctor: { id: number } };

export type DoctorGroup<Row extends WithDoctor> = {
  doctor: Row["doctor"];
  rows: Row[];
};

/** Adjacent rows of one doctor, in the API's order, which is never changed here. */
export function groupByDoctor<Row extends WithDoctor>(
  rows: readonly Row[],
): DoctorGroup<Row>[] {
  const groups: DoctorGroup<Row>[] = [];
  for (const row of rows) {
    const current = groups.at(-1);
    if (current?.doctor.id === row.doctor.id) current.rows.push(row);
    else groups.push({ doctor: row.doctor, rows: [row] });
  }
  return groups;
}
