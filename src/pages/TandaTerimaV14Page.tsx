import React, {
  useEffect,
  useMemo,
  useState,
} from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/lib/supabase";
import { store } from "@/services/store";
import {
  EXTERNAL_RECEIVER_ID,
  V14DocumentHandover,
  cancelDocumentHandoverV14,
  confirmDocumentHandoverV14,
  confirmDocumentReturnV14,
  createDocumentHandoverV14,
  getDocumentHandoverHistoryV14,
  getEligibleInternalHandoverReceiversV14,
  getVisibleDocumentHandoversV14,
  rejectDocumentHandoverV14,
  resendDocumentHandoverV14,
  resolveDocumentHandoverDiscrepancyV14,
  returnDocumentHandoverV14,
  waitForDocumentHandoverV14Sync,
} from "@/services/documentHandoverV14Service";
import {
  saveDocumentHandoverFile,
  downloadDocumentHandoverFile,
} from "@/services/documentHandoverFileStorage";
import type {
  AuditLog,
  DocumentHandoverItem,
  DocumentHandoverRelatedModule,
  User,
} from "@/types";
import {
  formatSlaDueDate,
  getSlaState,
} from "@/utils/slaGovernance";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileText,
  Plus,
  RotateCcw,
  Search,
  Send,
  X,
} from "lucide-react";

type ReceiptFilter =
  | "ALL"
  | "TO_RECEIVE"
  | "SENT"
  | "RECEIVED"
  | "DISCREPANCY"
  | "CLOSED";

type FormMode =
  | "CREATE"
  | "RESEND"
  | "RETURN";

type DraftItem = {
  sourceItemId?: string;
  documentType:
    DocumentHandoverItem["documentType"];
  description: string;
  physicalForm:
    DocumentHandoverItem["physicalForm"];
  quantity: number;
  notes: string;
};

type DecisionItem = {
  itemId: string;
  receivedQuantity: number;
  receiverNotes: string;
};

const DOCUMENT_TYPES:
  DocumentHandoverItem["documentType"][] = [
  "Tagihan / Invoice",
  "Kwitansi",
  "Polis",
  "SPAJ",
  "SPAK",
  "Surat",
  "Proposal",
  "Dokumen Closing",
  "Lampiran",
  "Lainnya",
];

const PHYSICAL_FORMS:
  DocumentHandoverItem["physicalForm"][] = [
  "Asli",
  "Copy",
  "Legalized Copy",
];

const emptyItem = (): DraftItem => ({
  documentType:
    "Tagihan / Invoice",
  description:
    "",
  physicalForm:
    "Asli",
  quantity:
    1,
  notes:
    "",
});

const today = () =>
  new Date()
    .toISOString()
    .slice(0, 10);

const formatDateOnly = (
  value: string
) =>
  new Date(
    `${value}T12:00:00`
  ).toLocaleDateString(
    "id-ID",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );

const formatDateTime = (
  value?: string
) =>
  value
    ? new Date(
        value
      ).toLocaleString(
        "id-ID",
        {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }
      )
    : "-";

const statusClass = (
  status:
    V14DocumentHandover["status"]
) => {
  if (
    status === "DITERIMA"
  ) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (
    status === "DIKEMBALIKAN"
  ) {
    return "border-violet-200 bg-violet-50 text-violet-700";
  }

  if (
    status === "SELISIH DOKUMEN" ||
    status === "SELISIH PENGEMBALIAN"
  ) {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  if (
    status === "MENUNGGU KONFIRMASI PENGEMBALIAN"
  ) {
    return "border-violet-200 bg-violet-50 text-violet-700";
  }

  if (
    status === "DITOLAK" ||
    status === "DIBATALKAN"
  ) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-blue-200 bg-blue-50 text-blue-700";
};

const ACTION_LABELS:
  Record<string, string> = {
  SUBMIT_HANDOVER:
    "Penyerahan Dokumen",
  SUBMIT_EXTERNAL_HANDOVER:
    "Penyerahan ke Fungsi Lainnya",
  RESUBMIT_HANDOVER:
    "Penyerahan Ulang",
  CONFIRM_RECEIVED:
    "Penerimaan Dokumen",
  REPORT_DISCREPANCY:
    "Selisih Dokumen",
  RESOLVE_DOCUMENT_DISCREPANCY:
    "Selisih Dokumen Diselesaikan",
  RETURN_HANDOVER_SUBMITTED:
    "Pengembalian Dokumen",
  RETURN_HANDOVER_CONFIRMED:
    "Penerimaan Kembali",
  RETURN_HANDOVER_DISCREPANCY:
    "Selisih Pengembalian",
  RESOLVE_RETURN_DISCREPANCY:
    "Selisih Pengembalian Diselesaikan",
  REJECT_HANDOVER:
    "Penerimaan Ditolak",
  CANCEL_HANDOVER:
    "Tanda Terima Dibatalkan",
};

const SlaBadge:
  React.FC<{
    receipt:
      V14DocumentHandover;
  }> = ({
    receipt,
  }) => {
    if (
      receipt.status !==
      "MENUNGGU PENERIMAAN"
    ) {
      return null;
    }

    const state =
      getSlaState(
        receipt.submittedAt
      );

    const cls =
      state === "OVERDUE"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : state === "DUE_TODAY"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";

    return (
      <span
        className={`rounded-md border px-2 py-1 text-[10px] font-bold ${cls}`}
      >
        {state === "OVERDUE"
          ? "OVERDUE"
          : state === "DUE_TODAY"
          ? "DUE TODAY"
          : "ON SLA"}
        {" · due "}
        {formatSlaDueDate(
          receipt.submittedAt
        )}
      </span>
    );
  };

const TandaTerimaV14Page:
  React.FC = () => {
    const [
      currentUser,
      setCurrentUser,
    ] = useState<User>(
      store.getCurrentUser()
    );

    const [
      receipts,
      setReceipts,
    ] = useState<
      V14DocumentHandover[]
    >([]);

    const [
      auditLogs,
      setAuditLogs,
    ] = useState<AuditLog[]>([]);

    const [
      filter,
      setFilter,
    ] = useState<ReceiptFilter>(
      "ALL"
    );

    const [
      search,
      setSearch,
    ] = useState("");

    const [
      formMode,
      setFormMode,
    ] = useState<FormMode | null>(
      null
    );

    const [
      targetReceipt,
      setTargetReceipt,
    ] = useState<
      V14DocumentHandover | null
    >(null);

    const [
      handoverDate,
      setHandoverDate,
    ] = useState(
      today()
    );

    const [
      receiverId,
      setReceiverId,
    ] = useState("");

    const [
      externalDestination,
      setExternalDestination,
    ] = useState("");

    const [
      relatedModule,
      setRelatedModule,
    ] = useState<
      DocumentHandoverRelatedModule
    >("NONE");

    const [
      relatedTransactionId,
      setRelatedTransactionId,
    ] = useState("");

    const [
      relatedDescription,
      setRelatedDescription,
    ] = useState("");

    const [
      draftItems,
      setDraftItems,
    ] = useState<DraftItem[]>([
      emptyItem(),
    ]);

    const [
      handoverPhoto,
      setHandoverPhoto,
    ] = useState<File | null>(
      null
    );

    const [
      receiveReceipt,
      setReceiveReceipt,
    ] = useState<
      V14DocumentHandover | null
    >(null);

    const [
      decisionItems,
      setDecisionItems,
    ] = useState<DecisionItem[]>([]);

    const [
      receiptPhoto,
      setReceiptPhoto,
    ] = useState<File | null>(
      null
    );

    const [
      receiverNotes,
      setReceiverNotes,
    ] = useState("");

    const [
      resolutionReceipt,
      setResolutionReceipt,
    ] = useState<
      V14DocumentHandover | null
    >(null);

    const [
      resolutionNotes,
      setResolutionNotes,
    ] = useState("");

    const [
      resolutionPhoto,
      setResolutionPhoto,
    ] = useState<File | null>(
      null
    );

    const [
      detailReceipt,
      setDetailReceipt,
    ] = useState<
      V14DocumentHandover | null
    >(null);

    const [
      submitting,
      setSubmitting,
    ] = useState(false);

    useEffect(
      () => {
        const refresh =
          () => {
            const user =
              store.getCurrentUser();

            setCurrentUser(
              user
            );

            setReceipts(
              getVisibleDocumentHandoversV14(
                user
              )
            );

            setAuditLogs(
              store.getAuditLogs()
            );
          };

        refresh();
        return store.subscribe(
          refresh
        );
      },
      []
    );

    const eligibleReceivers =
      useMemo(
        () =>
          getEligibleInternalHandoverReceiversV14(
            currentUser
          ),
        [currentUser, receipts]
      );

    const relationOptions =
      useMemo(
        () => {
          if (
            relatedModule ===
            "PIPELINE"
          ) {
            return store
              .getPipelines()
              .map(
                item => ({
                  id: item.id,
                  label:
                    `${item.id} · ${item.customerName} · ${item.productName}`,
                })
              );
          }

          if (
            relatedModule ===
            "BOOKING"
          ) {
            return store
              .getBookings()
              .map(
                item => ({
                  id: item.id,
                  label:
                    `${item.id} · ${item.customerName} · ${item.productName}`,
                })
              );
          }

          if (
            relatedModule ===
            "REIMBURSEMENT"
          ) {
            return store
              .getReimbursements()
              .map(
                item => ({
                  id: item.id,
                  label:
                    `${item.id} · ${item.companyName} · ${item.userName}`,
                })
              );
          }

          return [];
        },
        [
          relatedModule,
          receipts,
        ]
      );

    const resetForm =
      () => {
        setFormMode(null);
        setTargetReceipt(null);
        setHandoverDate(
          today()
        );
        setReceiverId("");
        setExternalDestination("");
        setRelatedModule("NONE");
        setRelatedTransactionId("");
        setRelatedDescription("");
        setDraftItems([
          emptyItem(),
        ]);
        setHandoverPhoto(null);
      };

    const openCreate =
      () => {
        resetForm();
        setFormMode("CREATE");
      };

    const openResend = (
      receipt:
        V14DocumentHandover
    ) => {
      resetForm();
      setTargetReceipt(receipt);
      setFormMode("RESEND");
      setReceiverId(
        receipt.receiverUserId
      );
      setHandoverDate(
        today()
      );
      setRelatedModule(
        receipt.relatedModule
      );
      setRelatedTransactionId(
        receipt.relatedTransactionId ||
        ""
      );
      setRelatedDescription(
        receipt.relatedDescription ||
        ""
      );
      setDraftItems(
        receipt.items.map(
          item => ({
            sourceItemId:
              item.id,
            documentType:
              item.documentType,
            description:
              item.description,
            physicalForm:
              item.physicalForm,
            quantity:
              Number(item.quantity),
            notes:
              item.notes || "",
          })
        )
      );
    };

    const openReturn = (
      receipt:
        V14DocumentHandover
    ) => {
      resetForm();
      setTargetReceipt(receipt);
      setFormMode("RETURN");
      setReceiverId(
        receipt.senderUserId
      );
      setHandoverDate(
        today()
      );
      setDraftItems(
        receipt.items
          .filter(
            item =>
              Number(
                item.receivedQuantity ??
                item.quantity
              ) > 0
          )
          .map(
            item => ({
              sourceItemId:
                item.id,
              documentType:
                item.documentType,
              description:
                item.description,
              physicalForm:
                item.physicalForm,
              quantity:
                Math.max(
                  1,
                  Number(
                    item.receivedQuantity ??
                    item.quantity
                  )
                ),
              notes:
                `Pengembalian ${receipt.id}`,
            })
          )
      );
    };

    const submitForm =
      async () => {
        if (!formMode) {
          return;
        }

        if (!handoverPhoto) {
          window.alert(
            formMode === "RETURN"
              ? "Foto bukti pengembalian wajib diupload."
              : "Foto bukti penyerahan wajib diupload."
          );
          return;
        }

        if (
          draftItems.length < 1 ||
          draftItems.some(
            item =>
              !item.description.trim() ||
              Number(item.quantity) < 1
          )
        ) {
          window.alert(
            "Minimal 1 dokumen dengan deskripsi dan jumlah yang valid wajib diisi."
          );
          return;
        }

        if (
          formMode === "CREATE" &&
          !receiverId
        ) {
          window.alert(
            "Penerima wajib dipilih."
          );
          return;
        }

        if (
          formMode === "CREATE" &&
          receiverId ===
            EXTERNAL_RECEIVER_ID &&
          !externalDestination.trim()
        ) {
          window.alert(
            "Nama fungsi / unit tujuan wajib diisi."
          );
          return;
        }

        try {
          setSubmitting(true);

          let receiptId =
            targetReceipt?.id ||
            "";

          if (
            formMode === "CREATE"
          ) {
            const {
              data,
              error,
            } =
              await supabase.rpc(
                "reserve_document_handover_id_v13_1",
                {
                  p_handover_date:
                    handoverDate,
                }
              );

            if (
              error ||
              !data
            ) {
              throw new Error(
                error?.message ||
                "Gagal mendapatkan nomor Tanda Terima dari server."
              );
            }

            receiptId =
              String(data);
          }

          if (!receiptId) {
            throw new Error(
              "Nomor Tanda Terima tidak ditemukan."
            );
          }

          const receiverForFile =
            formMode === "CREATE"
              ? receiverId
              : formMode === "RETURN"
              ? targetReceipt!.senderUserId
              : targetReceipt!.receiverUserId;

          const prefix =
            formMode === "RETURN"
              ? "TRM-RETURN"
              : formMode === "RESEND"
              ? "TRM-RESEND"
              : "TRM-SUBMIT";

          const fileId =
            `${prefix}-${Date.now()}-${Math.random()
              .toString(36)
              .slice(2, 6)}`;

          await saveDocumentHandoverFile({
            id:
              fileId,
            transactionId:
              receiptId,
            fileName:
              handoverPhoto.name,
            fileType:
              handoverPhoto.type ||
              "image/*",
            fileSize:
              handoverPhoto.size,
            uploadedByUserId:
              currentUser.id,
            uploadedByName:
              currentUser.name,
            uploadedAt:
              new Date().toISOString(),
            senderUserId:
              currentUser.id,
            receiverUserId:
              receiverForFile,
            blob:
              handoverPhoto,
          });

          const evidence = {
            fileId,
            fileName:
              handoverPhoto.name,
            fileSize:
              handoverPhoto.size,
          };

          if (
            formMode === "CREATE"
          ) {
            createDocumentHandoverV14({
              receiptId,
              handoverDate,
              receiverUserId:
                receiverId,
              externalDestination:
                receiverId ===
                EXTERNAL_RECEIVER_ID
                  ? externalDestination
                  : undefined,
              relatedModule,
              relatedTransactionId:
                relatedTransactionId ||
                undefined,
              relatedDescription:
                relatedDescription ||
                undefined,
              items:
                draftItems.map(
                  item => ({
                    documentType:
                      item.documentType,
                    description:
                      item.description.trim(),
                    physicalForm:
                      item.physicalForm,
                    quantity:
                      Number(item.quantity),
                    notes:
                      item.notes.trim() ||
                      undefined,
                  })
                ),
              evidence,
            });
          } else if (
            formMode === "RESEND"
          ) {
            resendDocumentHandoverV14(
              receiptId,
              {
                handoverDate,
                items:
                  draftItems.map(
                    item => ({
                      documentType:
                        item.documentType,
                      description:
                        item.description.trim(),
                      physicalForm:
                        item.physicalForm,
                      quantity:
                        Number(item.quantity),
                      notes:
                        item.notes.trim() ||
                        undefined,
                    })
                  ),
                evidence,
              }
            );
          } else {
            returnDocumentHandoverV14(
              receiptId,
              {
                handoverDate,
                items:
                  draftItems.map(
                    item => ({
                      sourceItemId:
                        item.sourceItemId,
                      description:
                        item.description.trim(),
                      quantity:
                        Number(item.quantity),
                      notes:
                        item.notes.trim() ||
                        undefined,
                    })
                  ),
                evidence,
              }
            );
          }

          await waitForDocumentHandoverV14Sync();

          const successMessage =
            formMode === "CREATE"
              ? receiverId ===
                EXTERNAL_RECEIVER_ID
                ? `${receiptId} berhasil dicatat sebagai terkirim final ke ${externalDestination.trim()}.`
                : `${receiptId} berhasil dibuat dan dikirim.`
              : formMode === "RESEND"
              ? `${receiptId} berhasil dikirim ulang menggunakan nomor registry yang sama.`
              : `Pengembalian ${receiptId} berhasil dikirim.`;

          resetForm();
          window.alert(
            successMessage
          );
        } catch (error) {
          window.alert(
            error instanceof Error
              ? error.message
              : "Gagal memproses Tanda Terima."
          );
        } finally {
          setSubmitting(false);
        }
      };

    const openReceive = (
      receipt:
        V14DocumentHandover
    ) => {
      const sourceItems =
        receipt.status ===
          "MENUNGGU KONFIRMASI PENGEMBALIAN"
          ? receipt.returnItems || []
          : receipt.items;

      setReceiveReceipt(
        receipt
      );
      setDecisionItems(
        sourceItems.map(
          item => ({
            itemId:
              item.id,
            receivedQuantity:
              Number(item.quantity),
            receiverNotes:
              "",
          })
        )
      );
      setReceiptPhoto(null);
      setReceiverNotes("");
    };

    const submitDecision =
      async (
        discrepancy:
          boolean
      ) => {
        if (!receiveReceipt) {
          return;
        }

        try {
          setSubmitting(true);

          let evidence:
            | {
                fileId: string;
                fileName: string;
                fileSize: number;
              }
            | undefined;

          if (receiptPhoto) {
            const fileId =
              `TRM-ACK-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 6)}`;

            await saveDocumentHandoverFile({
              id:
                fileId,
              transactionId:
                receiveReceipt.id,
              fileName:
                receiptPhoto.name,
              fileType:
                receiptPhoto.type ||
                "image/*",
              fileSize:
                receiptPhoto.size,
              uploadedByUserId:
                currentUser.id,
              uploadedByName:
                currentUser.name,
              uploadedAt:
                new Date().toISOString(),
              senderUserId:
                receiveReceipt.senderUserId,
              receiverUserId:
                receiveReceipt.receiverUserId,
              blob:
                receiptPhoto,
            });

            evidence = {
              fileId,
              fileName:
                receiptPhoto.name,
              fileSize:
                receiptPhoto.size,
            };
          }

          const isReturn =
            receiveReceipt.status ===
            "MENUNGGU KONFIRMASI PENGEMBALIAN";

          if (isReturn) {
            confirmDocumentReturnV14(
              receiveReceipt.id,
              {
                status:
                  discrepancy
                    ? "SELISIH PENGEMBALIAN"
                    : "DIKEMBALIKAN",
                items:
                  decisionItems,
                notes:
                  receiverNotes,
                evidence,
              }
            );
          } else {
            confirmDocumentHandoverV14(
              receiveReceipt.id,
              {
                status:
                  discrepancy
                    ? "SELISIH DOKUMEN"
                    : "DITERIMA",
                items:
                  decisionItems,
                notes:
                  receiverNotes,
                evidence,
              }
            );
          }

          await waitForDocumentHandoverV14Sync();

          setReceiveReceipt(null);
          setReceiptPhoto(null);
          setReceiverNotes("");

          window.alert(
            discrepancy
              ? "Selisih berhasil dicatat."
              : isReturn
              ? "Penerimaan kembali berhasil dikonfirmasi. Registry kini dapat dikirim ulang oleh pengirim awal."
              : "Penerimaan berhasil dikonfirmasi."
          );
        } catch (error) {
          window.alert(
            error instanceof Error
              ? error.message
              : "Gagal memproses penerimaan."
          );
        } finally {
          setSubmitting(false);
        }
      };

    const openResolution = (
      receipt:
        V14DocumentHandover
    ) => {
      setResolutionReceipt(
        receipt
      );
      setResolutionNotes("");
      setResolutionPhoto(null);
    };

    const submitResolution =
      async () => {
        if (!resolutionReceipt) {
          return;
        }

        if (
          !resolutionNotes.trim()
        ) {
          window.alert(
            "Catatan penyelesaian selisih wajib diisi."
          );
          return;
        }

        if (!resolutionPhoto) {
          window.alert(
            "Foto bukti penyelesaian selisih wajib diupload."
          );
          return;
        }

        try {
          setSubmitting(true);

          const fileId =
            `TRM-RESOLVE-${Date.now()}-${Math.random()
              .toString(36)
              .slice(2, 6)}`;

          await saveDocumentHandoverFile({
            id:
              fileId,
            transactionId:
              resolutionReceipt.id,
            fileName:
              resolutionPhoto.name,
            fileType:
              resolutionPhoto.type ||
              "image/*",
            fileSize:
              resolutionPhoto.size,
            uploadedByUserId:
              currentUser.id,
            uploadedByName:
              currentUser.name,
            uploadedAt:
              new Date().toISOString(),
            senderUserId:
              resolutionReceipt.senderUserId,
            receiverUserId:
              resolutionReceipt.receiverUserId,
            blob:
              resolutionPhoto,
          });

          resolveDocumentHandoverDiscrepancyV14(
            resolutionReceipt.id,
            {
              notes:
                resolutionNotes,
              evidence: {
                fileId,
                fileName:
                  resolutionPhoto.name,
                fileSize:
                  resolutionPhoto.size,
              },
            }
          );

          await waitForDocumentHandoverV14Sync();

          setResolutionReceipt(null);
          setResolutionNotes("");
          setResolutionPhoto(null);

          window.alert(
            "Selisih berhasil diselesaikan."
          );
        } catch (error) {
          window.alert(
            error instanceof Error
              ? error.message
              : "Gagal menyelesaikan selisih."
          );
        } finally {
          setSubmitting(false);
        }
      };

    const rejectReceipt =
      async (
        receipt:
          V14DocumentHandover
      ) => {
        const reason =
          window.prompt(
            "Masukkan alasan penolakan penerimaan:"
          );

        if (!reason) {
          return;
        }

        try {
          rejectDocumentHandoverV14(
            receipt.id,
            reason
          );
          await waitForDocumentHandoverV14Sync();
        } catch (error) {
          window.alert(
            error instanceof Error
              ? error.message
              : "Gagal menolak Tanda Terima."
          );
        }
      };

    const cancelReceipt =
      async (
        receipt:
          V14DocumentHandover
      ) => {
        const reason =
          window.prompt(
            "Masukkan alasan pembatalan Tanda Terima:"
          );

        if (!reason) {
          return;
        }

        try {
          cancelDocumentHandoverV14(
            receipt.id,
            reason
          );
          await waitForDocumentHandoverV14Sync();
        } catch (error) {
          window.alert(
            error instanceof Error
              ? error.message
              : "Gagal membatalkan Tanda Terima."
          );
        }
      };

    const getPosition = (
      receipt:
        V14DocumentHandover
    ) => {
      if (
        receipt.externalReceiver
      ) {
        return {
          primary:
            receipt.receiverName,
          secondary:
            "Terkirim final ke Fungsi Lainnya",
        };
      }

      if (
        receipt.status ===
        "MENUNGGU PENERIMAAN"
      ) {
        return {
          primary:
            receipt.receiverName,
          secondary:
            "Dalam proses penyerahan",
        };
      }

      if (
        receipt.status ===
          "DITERIMA" ||
        receipt.status ===
          "SELISIH DOKUMEN"
      ) {
        return {
          primary:
            receipt.receiverName,
          secondary:
            receipt.status ===
            "SELISIH DOKUMEN"
              ? "Perlu penyelesaian selisih"
              : "Dokumen berada di penerima",
        };
      }

      if (
        receipt.status ===
        "MENUNGGU KONFIRMASI PENGEMBALIAN"
      ) {
        return {
          primary:
            receipt.senderName,
          secondary:
            "Dalam proses pengembalian",
        };
      }

      if (
        receipt.status ===
          "DIKEMBALIKAN" ||
        receipt.status ===
          "SELISIH PENGEMBALIAN"
      ) {
        return {
          primary:
            receipt.senderName,
          secondary:
            receipt.status ===
            "DIKEMBALIKAN"
              ? "Dokumen kembali; dapat dikirim ulang"
              : "Perlu penyelesaian selisih pengembalian",
        };
      }

      return {
        primary:
          receipt.senderName,
        secondary:
          "Proses ditutup",
      };
    };

    const counts =
      useMemo(
        () => ({
          ALL:
            receipts.length,
          TO_RECEIVE:
            receipts.filter(
              receipt =>
                (
                  receipt.receiverUserId ===
                    currentUser.id &&
                  receipt.status ===
                    "MENUNGGU PENERIMAAN"
                ) ||
                (
                  receipt.senderUserId ===
                    currentUser.id &&
                  receipt.status ===
                    "MENUNGGU KONFIRMASI PENGEMBALIAN"
                )
            ).length,
          SENT:
            receipts.filter(
              receipt =>
                receipt.senderUserId ===
                currentUser.id
            ).length,
          RECEIVED:
            receipts.filter(
              receipt =>
                receipt.status ===
                "DITERIMA"
            ).length,
          DISCREPANCY:
            receipts.filter(
              receipt =>
                receipt.status ===
                  "SELISIH DOKUMEN" ||
                receipt.status ===
                  "SELISIH PENGEMBALIAN"
            ).length,
          CLOSED:
            receipts.filter(
              receipt =>
                receipt.status ===
                  "DITOLAK" ||
                receipt.status ===
                  "DIBATALKAN"
            ).length,
        }),
        [
          receipts,
          currentUser.id,
        ]
      );

    const filteredReceipts =
      useMemo(
        () => {
          const keyword =
            search
              .trim()
              .toLowerCase();

          return receipts.filter(
            receipt => {
              const pass =
                filter === "ALL"
                  ? true
                  : filter === "TO_RECEIVE"
                  ? (
                      receipt.receiverUserId ===
                        currentUser.id &&
                      receipt.status ===
                        "MENUNGGU PENERIMAAN"
                    ) ||
                    (
                      receipt.senderUserId ===
                        currentUser.id &&
                      receipt.status ===
                        "MENUNGGU KONFIRMASI PENGEMBALIAN"
                    )
                  : filter === "SENT"
                  ? receipt.senderUserId ===
                    currentUser.id
                  : filter === "RECEIVED"
                  ? receipt.status ===
                    "DITERIMA"
                  : filter === "DISCREPANCY"
                  ? receipt.status ===
                      "SELISIH DOKUMEN" ||
                    receipt.status ===
                      "SELISIH PENGEMBALIAN"
                  : receipt.status ===
                      "DITOLAK" ||
                    receipt.status ===
                      "DIBATALKAN";

              if (!pass) {
                return false;
              }

              if (!keyword) {
                return true;
              }

              return [
                receipt.id,
                receipt.senderName,
                receipt.receiverName,
                receipt.externalDestination,
                receipt.relatedTransactionId,
                receipt.relatedDescription,
                ...receipt.items.map(
                  item =>
                    item.description
                ),
              ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(
                  keyword
                );
            }
          );
        },
        [
          receipts,
          currentUser.id,
          filter,
          search,
        ]
      );

    const historyFor = (
      receipt:
        V14DocumentHandover
    ) =>
      getDocumentHandoverHistoryV14(
        receipt,
        auditLogs
      );

    const downloadEvidence =
      async (
        log:
          AuditLog
      ) => {
        if (!log.evidenceFileId) {
          return;
        }

        try {
          await downloadDocumentHandoverFile(
            log.evidenceFileId,
            log.evidenceFileName
          );
        } catch (error) {
          window.alert(
            error instanceof Error
              ? error.message
              : "Foto bukti tidak dapat didownload."
          );
        }
      };

    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-6 w-6 text-blue-600" />
                <h1 className="text-xl font-black text-gray-900">
                  Tanda Terima Dokumen
                </h1>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Registry chain of custody dokumen fisik. Nomor TRM yang sama dapat digunakan kembali setelah dokumen dikembalikan.
              </p>
            </div>

            <Button
              type="button"
              onClick={openCreate}
              className="gap-2 bg-blue-600 text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Buat Tanda Terima
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            {[
              ["ALL", "Semua", counts.ALL],
              ["TO_RECEIVE", "Menunggu Saya Terima", counts.TO_RECEIVE],
              ["SENT", "Saya Kirim", counts.SENT],
              ["RECEIVED", "Diterima", counts.RECEIVED],
              ["DISCREPANCY", "Selisih", counts.DISCREPANCY],
              ["CLOSED", "Ditolak / Batal", counts.CLOSED],
            ].map(
              item => (
                <button
                  key={item[0]}
                  type="button"
                  onClick={() =>
                    setFilter(
                      item[0] as ReceiptFilter
                    )
                  }
                  className={`rounded-xl border p-3 text-left transition ${
                    filter === item[0]
                      ? "border-blue-300 bg-blue-50 shadow-sm"
                      : "border-gray-200 bg-white hover:border-blue-200"
                  }`}
                >
                  <div className="text-[10px] font-bold uppercase text-gray-500">
                    {item[1]}
                  </div>
                  <div className="mt-1 text-2xl font-black text-gray-900">
                    {item[2]}
                  </div>
                </button>
              )
            )}
          </div>

          <Card className="border-gray-200">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-sm font-black">
                    Daftar Tanda Terima
                  </CardTitle>
                  <p className="mt-1 text-xs text-gray-500">
                    History menyimpan setiap penyerahan, pengembalian, kirim ulang, dan evidence pada registry yang sama.
                  </p>
                </div>

                <div className="relative w-full lg:w-96">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    value={search}
                    onChange={event =>
                      setSearch(
                        event.target.value
                      )
                    }
                    placeholder="Cari nomor, pengirim, penerima, dokumen..."
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full min-w-[1120px] text-left text-xs">
                  <thead className="border-b border-gray-200 bg-gray-50 text-[10px] uppercase text-gray-600">
                    <tr>
                      <th className="p-3">Nomor</th>
                      <th className="p-3">Tanggal</th>
                      <th className="p-3">Pengirim</th>
                      <th className="p-3">Penerima</th>
                      <th className="p-3">Dokumen</th>
                      <th className="p-3">Posisi Dokumen</th>
                      <th className="p-3">Status / SLA</th>
                      <th className="p-3 text-right">Aksi</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100">
                    {filteredReceipts.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="p-10 text-center text-xs text-gray-400"
                        >
                          Belum ada Tanda Terima pada filter ini.
                        </td>
                      </tr>
                    ) : (
                      filteredReceipts.map(
                        receipt => (
                          <tr
                            key={receipt.id}
                            className="hover:bg-slate-50"
                          >
                            <td className="p-3">
                              <div className="font-mono font-black text-blue-700">
                                {receipt.id}
                              </div>
                              <div className="mt-1 text-[10px] text-gray-400">
                                Siklus {receipt.cycleNumber || 1}
                              </div>
                            </td>

                            <td className="p-3 text-gray-700">
                              {formatDateOnly(
                                receipt.handoverDate
                              )}
                            </td>

                            <td className="p-3">
                              <div className="font-semibold text-gray-900">
                                {receipt.senderName}
                              </div>
                              <div className="text-[10px] text-gray-400">
                                {String(
                                  receipt.senderDepartment
                                ) !== "None"
                                  ? receipt.senderDepartment
                                  : receipt.senderUnit}
                              </div>
                            </td>

                            <td className="p-3">
                              <div className="font-semibold text-gray-900">
                                {receipt.receiverName}
                              </div>
                              <div className="text-[10px] text-gray-400">
                                {receipt.externalReceiver
                                  ? "Fungsi Lainnya"
                                  : String(
                                      receipt.receiverDepartment
                                    ) !== "None"
                                  ? receipt.receiverDepartment
                                  : receipt.receiverUnit}
                              </div>
                            </td>

                            <td className="p-3">
                              <div className="font-black text-gray-900">
                                {receipt.items.length} item
                              </div>
                              <div className="mt-1 max-w-[220px] truncate text-[10px] text-gray-500">
                                {receipt.items
                                  .map(
                                    item =>
                                      item.description
                                  )
                                  .join(", ")}
                              </div>
                            </td>

                            <td className="p-3">
                              <div className="font-semibold text-gray-900">
                                {getPosition(receipt).primary}
                              </div>
                              <div className="mt-1 text-[10px] text-gray-400">
                                {getPosition(receipt).secondary}
                              </div>
                            </td>

                            <td className="p-3">
                              <span
                                className={`inline-flex rounded-md border px-2 py-1 text-[10px] font-black ${statusClass(
                                  receipt.status
                                )}`}
                              >
                                {receipt.status}
                              </span>
                              <div className="mt-2">
                                <SlaBadge receipt={receipt} />
                              </div>
                            </td>

                            <td className="p-3">
                              <div className="flex flex-wrap justify-end gap-2">
                                {receipt.senderUserId ===
                                  currentUser.id &&
                                  receipt.status ===
                                    "DIKEMBALIKAN" &&
                                  !receipt.externalReceiver && (
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={() =>
                                        openResend(
                                          receipt
                                        )
                                      }
                                      className="h-8 gap-1.5 bg-blue-600 text-[11px] text-white hover:bg-blue-700"
                                    >
                                      <RotateCcw className="h-3.5 w-3.5" />
                                      Kirim Lagi
                                    </Button>
                                  )}

                                {receipt.receiverUserId ===
                                  currentUser.id &&
                                  receipt.status ===
                                    "DITERIMA" &&
                                  !receipt.externalReceiver && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        openReturn(
                                          receipt
                                        )
                                      }
                                      className="h-8 border-violet-200 text-[11px] font-bold text-violet-700 hover:bg-violet-50"
                                    >
                                      Kembalikan
                                    </Button>
                                  )}

                                {receipt.senderUserId ===
                                  currentUser.id &&
                                  receipt.status ===
                                    "MENUNGGU KONFIRMASI PENGEMBALIAN" && (
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={() =>
                                        openReceive(
                                          receipt
                                        )
                                      }
                                      className="h-8 bg-violet-600 text-[11px] text-white hover:bg-violet-700"
                                    >
                                      Terima Kembali
                                    </Button>
                                  )}

                                {receipt.receiverUserId ===
                                  currentUser.id &&
                                  receipt.status ===
                                    "SELISIH DOKUMEN" && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        openResolution(
                                          receipt
                                        )
                                      }
                                      className="h-8 border-amber-300 bg-amber-50 text-[11px] font-bold text-amber-800 hover:bg-amber-100"
                                    >
                                      Selesaikan Selisih
                                    </Button>
                                  )}

                                {receipt.senderUserId ===
                                  currentUser.id &&
                                  receipt.status ===
                                    "SELISIH PENGEMBALIAN" && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        openResolution(
                                          receipt
                                        )
                                      }
                                      className="h-8 border-amber-300 bg-amber-50 text-[11px] font-bold text-amber-800 hover:bg-amber-100"
                                    >
                                      Selesaikan Selisih
                                    </Button>
                                  )}

                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    setDetailReceipt(
                                      receipt
                                    )
                                  }
                                  className="h-8 text-[11px]"
                                >
                                  Detail
                                </Button>

                                {receipt.receiverUserId ===
                                  currentUser.id &&
                                  receipt.status ===
                                    "MENUNGGU PENERIMAAN" && (
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={() =>
                                        openReceive(
                                          receipt
                                        )
                                      }
                                      className="h-8 bg-emerald-600 text-[11px] text-white hover:bg-emerald-700"
                                    >
                                      Terima
                                    </Button>
                                  )}

                                {receipt.receiverUserId ===
                                  currentUser.id &&
                                  receipt.status ===
                                    "MENUNGGU PENERIMAAN" && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        rejectReceipt(
                                          receipt
                                        )
                                      }
                                      className="h-8 border-rose-200 text-[11px] text-rose-700 hover:bg-rose-50"
                                    >
                                      Tolak
                                    </Button>
                                  )}

                                {receipt.senderUserId ===
                                  currentUser.id &&
                                  receipt.status ===
                                    "MENUNGGU PENERIMAAN" && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        cancelReceipt(
                                          receipt
                                        )
                                      }
                                      className="h-8 text-[11px]"
                                    >
                                      Batal
                                    </Button>
                                  )}
                              </div>
                            </td>
                          </tr>
                        )
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {formMode && (
            <div className="fixed inset-0 z-[240] flex items-center justify-center bg-black/45 p-4">
              <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl">
                <div className="sticky top-0 z-10 flex items-start justify-between border-b border-gray-200 bg-white px-6 py-5">
                  <div>
                    <div className="flex items-center gap-2">
                      {formMode === "RESEND" ? (
                        <RotateCcw className="h-5 w-5 text-blue-600" />
                      ) : (
                        <Send className="h-5 w-5 text-blue-600" />
                      )}
                      <h2 className="text-lg font-black text-gray-900">
                        {formMode === "CREATE"
                          ? "Buat Tanda Terima Dokumen"
                          : formMode === "RESEND"
                          ? "Kirim Ulang Dokumen"
                          : "Kembalikan Dokumen"}
                      </h2>
                    </div>

                    <p className="mt-1 text-xs text-gray-500">
                      {formMode === "RESEND"
                        ? `${targetReceipt?.id} tetap memakai nomor registry yang sama. Detail dokumen boleh diperbarui.`
                        : formMode === "RETURN"
                        ? `Pengembalian dicatat pada ${targetReceipt?.id} tanpa membuat nomor TRM baru.`
                        : "Nomor TRM dibuat otomatis saat Submit."}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={resetForm}
                    className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-6 p-6">
                  {targetReceipt && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                      <div className="text-[10px] font-bold uppercase tracking-wide text-blue-600">
                        Registry Tanda Terima
                      </div>
                      <div className="mt-1 font-mono text-sm font-black text-blue-900">
                        {targetReceipt.id}
                      </div>
                      <div className="mt-1 text-xs text-blue-700">
                        Siklus aktif berikutnya tetap berada pada registry ini.
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-gray-700">
                        {formMode === "RETURN"
                          ? "Tanggal Pengembalian *"
                          : formMode === "RESEND"
                          ? "Tanggal Penyerahan Ulang *"
                          : "Tanggal Penyerahan *"}
                      </label>
                      <Input
                        type="date"
                        value={handoverDate}
                        onChange={event =>
                          setHandoverDate(
                            event.target.value
                          )
                        }
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-gray-700">
                        Pengirim
                      </label>
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs">
                        <div className="font-bold text-gray-900">
                          {currentUser.name}
                        </div>
                        <div className="text-[10px] text-gray-500">
                          {currentUser.position}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-gray-700">
                        Penerima *
                      </label>

                      {formMode === "CREATE" ? (
                        <Select
                          value={receiverId}
                          onValueChange={value => {
                            setReceiverId(value);
                            if (
                              value !==
                              EXTERNAL_RECEIVER_ID
                            ) {
                              setExternalDestination("");
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih penerima..." />
                          </SelectTrigger>
                          <SelectContent
                            position="popper"
                            className="z-[300] max-h-72"
                          >
                            {eligibleReceivers.map(
                              user => (
                                <SelectItem
                                  key={user.id}
                                  value={user.id}
                                >
                                  {user.name} · {user.position}
                                </SelectItem>
                              )
                            )}
                            <SelectItem value={EXTERNAL_RECEIVER_ID}>
                              Fungsi Lainnya
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs font-bold text-gray-900">
                          {formMode === "RETURN"
                            ? targetReceipt?.senderName
                            : targetReceipt?.receiverName}
                        </div>
                      )}

                      <p className="mt-1 text-[10px] text-gray-400">
                        User internal memakai proses serah-terima. Fungsi Lainnya langsung final tanpa acknowledgement.
                      </p>
                    </div>

                    {formMode === "CREATE" && (
                      <div>
                        <label className="mb-1.5 block text-xs font-bold text-gray-700">
                          Terkait Proses
                        </label>
                        <Select
                          value={relatedModule}
                          onValueChange={value => {
                            setRelatedModule(
                              value as DocumentHandoverRelatedModule
                            );
                            setRelatedTransactionId("");
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent
                            position="popper"
                            className="z-[300]"
                          >
                            <SelectItem value="NONE">
                              Tidak terkait transaksi
                            </SelectItem>
                            <SelectItem value="PIPELINE">
                              Pipeline
                            </SelectItem>
                            <SelectItem value="BOOKING">
                              Booking Case
                            </SelectItem>
                            <SelectItem value="REIMBURSEMENT">
                              Reimbursement
                            </SelectItem>
                            <SelectItem value="LAINNYA">
                              Lainnya
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  {formMode === "CREATE" &&
                    receiverId ===
                      EXTERNAL_RECEIVER_ID && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <label className="mb-1.5 block text-xs font-black text-amber-900">
                          Nama Fungsi / Unit Tujuan *
                        </label>
                        <Input
                          value={externalDestination}
                          onChange={event =>
                            setExternalDestination(
                              event.target.value
                            )
                          }
                          placeholder="Contoh: Legal, Human Capital, Finance"
                          className="bg-white"
                        />
                        <p className="mt-2 text-[10px] leading-5 text-amber-800">
                          Registry akan langsung berstatus DITERIMA setelah submit. Tidak ada proses Terima / Tolak karena tujuan berada di luar user internal Tanda Terima.
                        </p>
                      </div>
                    )}

                  {formMode === "CREATE" &&
                    [
                      "PIPELINE",
                      "BOOKING",
                      "REIMBURSEMENT",
                    ].includes(
                      relatedModule
                    ) && (
                      <div>
                        <label className="mb-1.5 block text-xs font-bold text-gray-700">
                          Related Transaction ID
                        </label>
                        <Select
                          value={relatedTransactionId}
                          onValueChange={setRelatedTransactionId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih transaksi terkait..." />
                          </SelectTrigger>
                          <SelectContent
                            position="popper"
                            className="z-[300] max-h-72"
                          >
                            {relationOptions.map(
                              option => (
                                <SelectItem
                                  key={option.id}
                                  value={option.id}
                                >
                                  {option.label}
                                </SelectItem>
                              )
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                  {formMode === "CREATE" &&
                    relatedModule ===
                      "LAINNYA" && (
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-xs font-bold text-gray-700">
                            Related ID
                          </label>
                          <Input
                            value={relatedTransactionId}
                            onChange={event =>
                              setRelatedTransactionId(
                                event.target.value
                              )
                            }
                            placeholder="Nomor referensi bila ada"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-bold text-gray-700">
                            Keterangan
                          </label>
                          <Input
                            value={relatedDescription}
                            onChange={event =>
                              setRelatedDescription(
                                event.target.value
                              )
                            }
                            placeholder="Contoh: Dokumen Legal review"
                          />
                        </div>
                      </div>
                    )}

                  <div>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-black text-gray-900">
                          Daftar Dokumen Fisik
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {formMode === "RESEND"
                            ? "Pada kirim ulang, detail, qty, dan catatan boleh diperbarui tanpa mengganti nomor TRM."
                            : "Satu Tanda Terima dapat memuat lebih dari satu dokumen."}
                        </div>
                      </div>

                      {formMode !== "RETURN" && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setDraftItems(
                              current => [
                                ...current,
                                emptyItem(),
                              ]
                            )
                          }
                          className="gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          Tambah Dokumen
                        </Button>
                      )}
                    </div>

                    <div className="space-y-3">
                      {draftItems.map(
                        (item, index) => (
                          <div
                            key={`${index}-${item.sourceItemId || "new"}`}
                            className="rounded-xl border border-gray-200 bg-slate-50/50 p-4"
                          >
                            <div className="mb-3 flex items-center justify-between">
                              <div className="text-xs font-black text-gray-900">
                                Dokumen {index + 1}
                              </div>

                              {formMode !== "RETURN" &&
                                draftItems.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDraftItems(
                                        current =>
                                          current.filter(
                                            (_, itemIndex) =>
                                              itemIndex !==
                                              index
                                          )
                                      )
                                    }
                                    className="text-[11px] font-bold text-rose-600"
                                  >
                                    Hapus
                                  </button>
                                )}
                            </div>

                            <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                              <div className="md:col-span-3">
                                <label className="mb-1 block text-[10px] font-bold text-gray-600">
                                  Jenis Dokumen *
                                </label>
                                <Select
                                  value={item.documentType}
                                  onValueChange={value =>
                                    setDraftItems(
                                      current =>
                                        current.map(
                                          (currentItem, itemIndex) =>
                                            itemIndex === index
                                              ? {
                                                  ...currentItem,
                                                  documentType:
                                                    value as DocumentHandoverItem["documentType"],
                                                }
                                              : currentItem
                                        )
                                    )
                                  }
                                >
                                  <SelectTrigger className="bg-white">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent
                                    position="popper"
                                    className="z-[300]"
                                  >
                                    {DOCUMENT_TYPES.map(
                                      type => (
                                        <SelectItem
                                          key={type}
                                          value={type}
                                        >
                                          {type}
                                        </SelectItem>
                                      )
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="md:col-span-4">
                                <label className="mb-1 block text-[10px] font-bold text-gray-600">
                                  Nama / Deskripsi *
                                </label>
                                <Input
                                  value={item.description}
                                  onChange={event =>
                                    setDraftItems(
                                      current =>
                                        current.map(
                                          (currentItem, itemIndex) =>
                                            itemIndex === index
                                              ? {
                                                  ...currentItem,
                                                  description:
                                                    event.target.value,
                                                }
                                              : currentItem
                                        )
                                    )
                                  }
                                  className="bg-white"
                                  placeholder="Contoh: Proposal Revisi V2"
                                />
                              </div>

                              <div className="md:col-span-2">
                                <label className="mb-1 block text-[10px] font-bold text-gray-600">
                                  Bentuk *
                                </label>
                                <Select
                                  value={item.physicalForm}
                                  onValueChange={value =>
                                    setDraftItems(
                                      current =>
                                        current.map(
                                          (currentItem, itemIndex) =>
                                            itemIndex === index
                                              ? {
                                                  ...currentItem,
                                                  physicalForm:
                                                    value as DocumentHandoverItem["physicalForm"],
                                                }
                                              : currentItem
                                        )
                                    )
                                  }
                                >
                                  <SelectTrigger className="bg-white">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent
                                    position="popper"
                                    className="z-[300]"
                                  >
                                    {PHYSICAL_FORMS.map(
                                      form => (
                                        <SelectItem
                                          key={form}
                                          value={form}
                                        >
                                          {form}
                                        </SelectItem>
                                      )
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="md:col-span-1">
                                <label className="mb-1 block text-[10px] font-bold text-gray-600">
                                  Qty *
                                </label>
                                <Input
                                  type="number"
                                  min={1}
                                  value={item.quantity}
                                  onChange={event =>
                                    setDraftItems(
                                      current =>
                                        current.map(
                                          (currentItem, itemIndex) =>
                                            itemIndex === index
                                              ? {
                                                  ...currentItem,
                                                  quantity:
                                                    Math.max(
                                                      1,
                                                      Number(
                                                        event.target.value
                                                      ) || 1
                                                    ),
                                                }
                                              : currentItem
                                        )
                                    )
                                  }
                                  className="bg-white"
                                />
                              </div>

                              <div className="md:col-span-2">
                                <label className="mb-1 block text-[10px] font-bold text-gray-600">
                                  Catatan
                                </label>
                                <Input
                                  value={item.notes}
                                  onChange={event =>
                                    setDraftItems(
                                      current =>
                                        current.map(
                                          (currentItem, itemIndex) =>
                                            itemIndex === index
                                              ? {
                                                  ...currentItem,
                                                  notes:
                                                    event.target.value,
                                                }
                                              : currentItem
                                        )
                                    )
                                  }
                                  placeholder="Opsional"
                                  className="bg-white"
                                />
                              </div>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                    <div className="flex items-center gap-2 text-xs font-black text-blue-900">
                      <Camera className="h-4 w-4" />
                      {formMode === "RETURN"
                        ? "Foto Bukti Pengembalian *"
                        : formMode === "RESEND"
                        ? "Foto Bukti Penyerahan Ulang *"
                        : "Foto Bukti Penyerahan *"}
                    </div>
                    <p className="mt-1 text-[10px] leading-5 text-blue-700">
                      Foto akan tersimpan sebagai evidence event di History registry.
                    </p>
                    <Input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={event =>
                        setHandoverPhoto(
                          event.target.files?.[0] ||
                          null
                        )
                      }
                      className="mt-3 bg-white"
                    />
                    {handoverPhoto && (
                      <div className="mt-2 text-[10px] font-semibold text-blue-800">
                        {handoverPhoto.name} · {(
                          handoverPhoto.size /
                          1024
                        ).toFixed(1)} KB
                      </div>
                    )}
                  </div>
                </div>

                <div className="sticky bottom-0 flex justify-end gap-2 border-t border-gray-200 bg-white px-6 py-4">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={submitting}
                    onClick={resetForm}
                  >
                    Batal
                  </Button>
                  <Button
                    type="button"
                    disabled={submitting}
                    onClick={submitForm}
                    className="bg-blue-600 text-white hover:bg-blue-700"
                  >
                    {submitting
                      ? "Memproses..."
                      : formMode === "RESEND"
                      ? "Kirim Lagi"
                      : formMode === "RETURN"
                      ? "Kirim Pengembalian"
                      : receiverId === EXTERNAL_RECEIVER_ID
                      ? "Posting & Selesaikan"
                      : "Submit Tanda Terima"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {receiveReceipt && (
            <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/45 p-4">
              <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl">
                <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
                  <div>
                    <h2 className="text-base font-black text-gray-900">
                      {receiveReceipt.status ===
                      "MENUNGGU KONFIRMASI PENGEMBALIAN"
                        ? "Konfirmasi Penerimaan Kembali"
                        : "Konfirmasi Penerimaan"}
                    </h2>
                    <p className="mt-1 text-xs text-gray-500">
                      {receiveReceipt.id}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setReceiveReceipt(null)
                    }
                    className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-4 p-5">
                  <div className="space-y-3">
                    {decisionItems.map(
                      (item, index) => {
                        const sourceItems =
                          receiveReceipt.status ===
                          "MENUNGGU KONFIRMASI PENGEMBALIAN"
                            ? receiveReceipt.returnItems || []
                            : receiveReceipt.items;

                        const source =
                          sourceItems.find(
                            sourceItem =>
                              sourceItem.id ===
                              item.itemId
                          );

                        return (
                          <div
                            key={item.itemId}
                            className="rounded-xl border border-gray-200 p-4"
                          >
                            <div className="font-bold text-gray-900">
                              {source?.description ||
                                `Dokumen ${index + 1}`}
                            </div>
                            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <div>
                                <label className="mb-1 block text-[10px] font-bold text-gray-600">
                                  Qty Diterima
                                </label>
                                <Input
                                  type="number"
                                  min={0}
                                  max={
                                    Number(
                                      source?.quantity ||
                                      0
                                    )
                                  }
                                  value={item.receivedQuantity}
                                  onChange={event =>
                                    setDecisionItems(
                                      current =>
                                        current.map(
                                          currentItem =>
                                            currentItem.itemId ===
                                            item.itemId
                                              ? {
                                                  ...currentItem,
                                                  receivedQuantity:
                                                    Math.max(
                                                      0,
                                                      Number(
                                                        event.target.value
                                                      ) || 0
                                                    ),
                                                }
                                              : currentItem
                                        )
                                    )
                                  }
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-[10px] font-bold text-gray-600">
                                  Catatan Item
                                </label>
                                <Input
                                  value={item.receiverNotes}
                                  onChange={event =>
                                    setDecisionItems(
                                      current =>
                                        current.map(
                                          currentItem =>
                                            currentItem.itemId ===
                                            item.itemId
                                              ? {
                                                  ...currentItem,
                                                  receiverNotes:
                                                    event.target.value,
                                                }
                                              : currentItem
                                        )
                                    )
                                  }
                                  placeholder="Opsional"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>

                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-center gap-2 text-xs font-black text-emerald-900">
                      <Camera className="h-4 w-4" />
                      Foto Bukti Penerimaan
                    </div>
                    <p className="mt-1 text-[10px] text-emerald-800">
                      Opsional. Jika diupload, foto akan masuk ke History event ini.
                    </p>
                    <Input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={event =>
                        setReceiptPhoto(
                          event.target.files?.[0] ||
                          null
                        )
                      }
                      className="mt-3 bg-white"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-gray-700">
                      Catatan
                    </label>
                    <Textarea
                      value={receiverNotes}
                      onChange={event =>
                        setReceiverNotes(
                          event.target.value
                        )
                      }
                      placeholder="Opsional"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-2 border-t border-gray-200 px-5 py-4">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={submitting}
                    onClick={() =>
                      setReceiveReceipt(null)
                    }
                  >
                    Batal
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={submitting}
                    onClick={() =>
                      submitDecision(true)
                    }
                    className="border-amber-300 text-amber-800 hover:bg-amber-50"
                  >
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Laporkan Selisih
                  </Button>
                  <Button
                    type="button"
                    disabled={submitting}
                    onClick={() =>
                      submitDecision(false)
                    }
                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {receiveReceipt.status ===
                    "MENUNGGU KONFIRMASI PENGEMBALIAN"
                      ? "Konfirmasi Diterima Kembali"
                      : "Konfirmasi Diterima"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {resolutionReceipt && (
            <div className="fixed inset-0 z-[255] flex items-center justify-center bg-black/45 p-4">
              <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
                <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
                  <div>
                    <h2 className="text-base font-black text-gray-900">
                      Selesaikan Selisih
                    </h2>
                    <p className="mt-1 text-xs text-gray-500">
                      {resolutionReceipt.id}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setResolutionReceipt(null)
                    }
                    className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-4 p-5">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-gray-700">
                      Catatan Penyelesaian *
                    </label>
                    <Textarea
                      value={resolutionNotes}
                      onChange={event =>
                        setResolutionNotes(
                          event.target.value
                        )
                      }
                      placeholder="Jelaskan penyelesaian selisih dokumen."
                    />
                  </div>

                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-center gap-2 text-xs font-black text-emerald-900">
                      <Camera className="h-4 w-4" />
                      Foto Bukti Penyelesaian *
                    </div>
                    <Input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={event =>
                        setResolutionPhoto(
                          event.target.files?.[0] ||
                          null
                        )
                      }
                      className="mt-3 bg-white"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-4">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={submitting}
                    onClick={() =>
                      setResolutionReceipt(null)
                    }
                  >
                    Batal
                  </Button>
                  <Button
                    type="button"
                    disabled={
                      submitting ||
                      !resolutionNotes.trim() ||
                      !resolutionPhoto
                    }
                    onClick={submitResolution}
                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    Konfirmasi Sudah Lengkap
                  </Button>
                </div>
              </div>
            </div>
          )}

          {detailReceipt && (
            <div className="fixed inset-0 z-[245] flex items-center justify-center bg-black/45 p-4">
              <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl">
                <div className="sticky top-0 z-10 flex items-start justify-between border-b border-gray-200 bg-white px-6 py-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-blue-600" />
                      <h2 className="text-lg font-black text-gray-900">
                        {detailReceipt.id}
                      </h2>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span
                        className={`rounded-md border px-2 py-1 text-[10px] font-black ${statusClass(
                          detailReceipt.status
                        )}`}
                      >
                        {detailReceipt.status}
                      </span>
                      <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-black text-slate-600">
                        Siklus {detailReceipt.cycleNumber || 1}
                      </span>
                      {detailReceipt.externalReceiver && (
                        <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-700">
                          Fungsi Lainnya
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setDetailReceipt(null)
                    }
                    className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-6 p-6">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    {[
                      [
                        "Tanggal Siklus Aktif",
                        formatDateOnly(
                          detailReceipt.handoverDate
                        ),
                      ],
                      [
                        "Pengirim",
                        detailReceipt.senderName,
                      ],
                      [
                        "Penerima",
                        detailReceipt.receiverName,
                      ],
                      [
                        "Posisi Dokumen",
                        getPosition(
                          detailReceipt
                        ).primary,
                      ],
                    ].map(
                      item => (
                        <div
                          key={item[0]}
                          className="rounded-xl border border-gray-200 bg-gray-50 p-3"
                        >
                          <div className="text-[10px] font-bold uppercase text-gray-400">
                            {item[0]}
                          </div>
                          <div className="mt-1 text-xs font-black text-gray-900">
                            {item[1]}
                          </div>
                        </div>
                      )
                    )}
                  </div>

                  <div>
                    <div className="mb-2 text-sm font-black text-gray-900">
                      Daftar Dokumen Siklus Aktif
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-gray-200">
                      <table className="w-full min-w-[760px] text-left text-xs">
                        <thead className="border-b border-gray-200 bg-gray-50 text-[10px] uppercase text-gray-600">
                          <tr>
                            <th className="p-3">Dokumen</th>
                            <th className="p-3">Bentuk</th>
                            <th className="p-3">Diserahkan</th>
                            <th className="p-3">Diterima</th>
                            <th className="p-3">Catatan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {detailReceipt.items.map(
                            item => (
                              <tr key={item.id}>
                                <td className="p-3">
                                  <div className="font-semibold text-gray-900">
                                    {item.description}
                                  </div>
                                  <div className="text-[10px] text-gray-400">
                                    {item.documentType}
                                  </div>
                                </td>
                                <td className="p-3">
                                  {item.physicalForm}
                                </td>
                                <td className="p-3 font-bold">
                                  {item.quantity}
                                </td>
                                <td className="p-3 font-bold">
                                  {item.receivedQuantity ?? "-"}
                                </td>
                                <td className="p-3 text-gray-600">
                                  {item.receiverNotes ||
                                    item.notes ||
                                    "-"}
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <div className="mb-3 text-sm font-black text-gray-900">
                      Riwayat Aksi Registry
                    </div>
                    <div className="space-y-2">
                      {historyFor(
                        detailReceipt
                      ).map(
                        log => (
                          <div
                            key={log.id}
                            className="rounded-xl border border-gray-200 bg-slate-50 p-3"
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <div className="text-xs font-black text-gray-900">
                                  {ACTION_LABELS[
                                    log.action
                                  ] ||
                                    log.action.replace(
                                      /_/g,
                                      " "
                                    )}
                                </div>
                                <div className="mt-1 text-[10px] text-gray-400">
                                  {formatDateTime(
                                    log.timestamp
                                  )}
                                </div>
                              </div>

                              {log.evidenceFileId && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    downloadEvidence(
                                      log
                                    )
                                  }
                                  className="h-8 gap-2 bg-white text-[11px]"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                  Download Foto
                                </Button>
                              )}
                            </div>

                            <div className="mt-1 text-[11px] text-gray-600">
                              {log.userName} · {log.userRole}
                            </div>

                            {log.reason && (
                              <div className="mt-1 text-[10px] leading-5 text-gray-500">
                                {log.reason}
                              </div>
                            )}

                            {log.fileReference && (
                              <div className="mt-2 rounded-lg border border-gray-200 bg-white p-2 text-[10px] leading-5 text-gray-600">
                                {log.fileReference}
                              </div>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </AppLayout>
    );
  };

export default TandaTerimaV14Page;
