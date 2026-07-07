const ORDER_STATUSES = ['pending', 'assigned', 'in_progress', 'completed', 'revision_requested', 'fixed', 'paid', 'cancelled'];
const TASK_STATUSES = ['assigned', 'in_progress', 'revision_requested', 'done'];
const BOOKING_STATUSES = ['scheduled', 'completed', 'cancelled'];

const ROLE_TASK_MAP = {
  transcriber: 'transcriber',
  arranger: 'arranger',
  artist: 'artist'
};

const isValidOrderStatus = (status) => ORDER_STATUSES.includes(status);
const isValidTaskStatus = (status) => TASK_STATUSES.includes(status);
const isValidBookingStatus = (status) => BOOKING_STATUSES.includes(status);

const canAssignRoleToTask = (userRole, specialistRole) => ROLE_TASK_MAP[userRole] === specialistRole;

const isMatchingPaymentAmount = (amount, expectedAmount) => {
  return Number(amount) === Number(expectedAmount);
};

const validateBookingTime = (startTime, endTime, now = new Date()) => {
  const startDate = new Date(startTime);
  const endDate = new Date(endTime);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return { valid: false, reason: 'INVALID_DATE' };
  }
  if (startDate <= now) {
    return { valid: false, reason: 'PAST_START_TIME' };
  }
  if (startDate >= endDate) {
    return { valid: false, reason: 'END_BEFORE_START' };
  }
  return { valid: true };
};

const hasBookingOverlap = (newStart, newEnd, existingStart, existingEnd) => {
  return new Date(newStart) < new Date(existingEnd) && new Date(newEnd) > new Date(existingStart);
};

module.exports = {
  ORDER_STATUSES,
  TASK_STATUSES,
  BOOKING_STATUSES,
  isValidOrderStatus,
  isValidTaskStatus,
  isValidBookingStatus,
  canAssignRoleToTask,
  isMatchingPaymentAmount,
  validateBookingTime,
  hasBookingOverlap
};
