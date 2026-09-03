export const BRANDED_DIALOG_EVENT =
  "pertalife:branded-action-dialog";

export type BrandedDialogTone =
  | "warning"
  | "danger"
  | "info";

type BrandedDialogBase = {
  heading?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: BrandedDialogTone;
};

export type BrandedConfirmOptions =
  BrandedDialogBase;

export type BrandedPromptOptions =
  BrandedDialogBase & {
    placeholder?: string;
    defaultValue?: string;
    required?: boolean;
    multiline?: boolean;
    expectedValue?: string;
    helperText?: string;
  };

export type BrandedDialogEventDetail =
  | ({
      kind: "confirm";
      resolve: (value: boolean) => void;
    } & BrandedConfirmOptions)
  | ({
      kind: "prompt";
      resolve: (
        value: string | null
      ) => void;
    } & BrandedPromptOptions);

export const brandedConfirm = (
  options: BrandedConfirmOptions
) =>
  new Promise<boolean>((resolve) => {
    window.dispatchEvent(
      new CustomEvent<BrandedDialogEventDetail>(
        BRANDED_DIALOG_EVENT,
        {
          detail: {
            kind: "confirm",
            confirmLabel:
              options.confirmLabel ||
              "Ya, Lanjutkan",
            cancelLabel:
              options.cancelLabel ||
              "Batal",
            tone:
              options.tone ||
              "warning",
            ...options,
            resolve,
          },
        }
      )
    );
  });

export const brandedPrompt = (
  options: BrandedPromptOptions
) =>
  new Promise<string | null>((resolve) => {
    window.dispatchEvent(
      new CustomEvent<BrandedDialogEventDetail>(
        BRANDED_DIALOG_EVENT,
        {
          detail: {
            kind: "prompt",
            confirmLabel:
              options.confirmLabel ||
              "Lanjutkan",
            cancelLabel:
              options.cancelLabel ||
              "Batal",
            tone:
              options.tone ||
              "warning",
            ...options,
            resolve,
          },
        }
      )
    );
  });
