const MEETING_ROOM_DIALOG_TITLE = "Tambah Booking Ruang Meeting";
const START_LABEL = "Jam Mulai";
const END_LABEL = "Jam Berakhir";

const pad = (value: number) => String(value).padStart(2, "0");

const addOneHour = (value: string) => {
  const [hour, minute] = value.split(":").map(Number);

  if (
    !Number.isFinite(hour) ||
    !Number.isFinite(minute)
  ) {
    return "";
  }

  const totalMinutes = Math.min(
    hour * 60 + minute + 60,
    23 * 60 + 59
  );

  return `${pad(Math.floor(totalMinutes / 60))}:${pad(totalMinutes % 60)}`;
};

const getFieldLabel = (input: HTMLInputElement) =>
  input.closest("div")?.querySelector("label")?.textContent?.trim() || "";

const setNativeInputValue = (
  input: HTMLInputElement,
  value: string
) => {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  )?.set;

  if (!setter) {
    return;
  }

  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

export const installMeetingRoomAutoDuration = () => {
  const handleInput = (event: Event) => {
    const target = event.target;

    if (
      !(target instanceof HTMLInputElement) ||
      target.type !== "time" ||
      !target.value
    ) {
      return;
    }

    const dialog = target.closest('[role="dialog"]');

    if (
      !dialog ||
      !dialog.textContent?.includes(MEETING_ROOM_DIALOG_TITLE) ||
      !getFieldLabel(target).includes(START_LABEL)
    ) {
      return;
    }

    const timeGrid = target.closest("div")?.parentElement;

    if (!timeGrid) {
      return;
    }

    const endInput = Array.from(
      timeGrid.querySelectorAll<HTMLInputElement>('input[type="time"]')
    ).find(input => getFieldLabel(input).includes(END_LABEL));

    if (!endInput || endInput === target) {
      return;
    }

    const nextEndTime = addOneHour(target.value);

    if (!nextEndTime || endInput.value === nextEndTime) {
      return;
    }

    setNativeInputValue(endInput, nextEndTime);
  };

  document.addEventListener("input", handleInput);

  return () => {
    document.removeEventListener("input", handleInput);
  };
};
