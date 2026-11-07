import { readPositiveId } from "@/lib/api/read-positive-id";
import { QUEUE_STATUSES, type QueueFilters, type QueueStatus } from "./types";

function isStatus(value: string | undefined): value is QueueStatus {
  return QUEUE_STATUSES.some((status) => status === value);
}

/**
 * The Queue page's address, ignoring what can't be valid, so that an old or edited link shows the list rather
 * than an error. A chosen doctor's list isn't paged, so a page number means nothing beside it.
 */
export function readQueueFilters(query: {
  doctor_id?: string | undefined;
  status?: string | undefined;
  page?: string | undefined;
}): QueueFilters {
  const doctorId =
    query.doctor_id === undefined ? null : readPositiveId(query.doctor_id);
  const page = query.page === undefined ? null : readPositiveId(query.page);

  return {
    doctorId,
    status: isStatus(query.status) ? query.status : null,
    page: doctorId === null && page !== null ? page : 1,
  };
}
