/**
 * Business-day helpers for Marketing Communication SLA.
 *
 * Definition requested by business:
 * - Working days are Monday-Friday.
 * - Saturday/Sunday are excluded.
 * - The system/current date is NOT counted.
 * - Public holidays are not excluded by this prototype rule.
 */

export const toLocalDateKey = (
  date:
    Date
): string => {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() +
      1
    ).padStart(
      2,
      '0'
    );

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      '0'
    );

  return `${year}-${month}-${day}`;
};

export const parseLocalDateKey = (
  value:
    string
): Date => {
  const [
    year,
    month,
    day,
  ] =
    value
      .split(
        '-'
      )
      .map(
        Number
      );

  return new Date(
    year,
    (
      month ||
      1
    ) -
      1,
    day ||
      1,
    12,
    0,
    0,
    0
  );
};

export const addBusinessDays = (
  startDate:
    Date,
  businessDays:
    number
): Date => {
  const result =
    new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate(),
      12,
      0,
      0,
      0
    );

  let added =
    0;

  while (
    added <
    businessDays
  ) {
    result.setDate(
      result.getDate() +
      1
    );

    const dayOfWeek =
      result.getDay();

    const isWeekday =
      dayOfWeek >=
        1 &&
      dayOfWeek <=
        5;

    if (
      isWeekday
    ) {
      added +=
        1;
    }
  }

  return result;
};

export const getMinimumMarcommNeedDateKey = (
  systemDate:
    Date =
    new Date()
): string =>
  toLocalDateKey(
    addBusinessDays(
      systemDate,
      3
    )
  );

export const isValidMarcommNeedDate = (
  needDate:
    string,
  systemDate:
    Date =
    new Date()
): boolean =>
  Boolean(
    needDate
  ) &&
  needDate >=
    getMinimumMarcommNeedDateKey(
      systemDate
    );

export const formatDateKeyId = (
  value:
    string
): string =>
  parseLocalDateKey(
    value
  ).toLocaleDateString(
    'id-ID',
    {
      day:
        '2-digit',
      month:
        'long',
      year:
        'numeric',
    }
  );
