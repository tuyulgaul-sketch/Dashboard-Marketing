import type {
  AppNotification,
  AuditLog,
  DocumentHandover,
  DocumentHandoverDiscrepancySnapshotItem,
  DocumentHandoverItem,
  DocumentHandoverRelatedModule,
  DocumentHandoverReturnItem,
  DocumentHandoverStatus,
  User,
} from "@/types";
import { store } from "@/services/store";
import { waitForCentralBusinessStorageSync } from "@/services/centralBusinessStorageRuntime";

const HANDOVER_STORAGE_KEY =
  "pertalife_document_handovers" as const;

export const EXTERNAL_RECEIVER_ID =
  "__FUNGSI_LAINNYA__";

export type V14DocumentHandover =
  Omit<
    DocumentHandover,
    | "receiverRole"
    | "receiverUnit"
    | "receiverDepartment"
  > & {
    receiverRole:
      | DocumentHandover["receiverRole"]
      | "EXTERNAL_FUNCTION";
    receiverUnit: string;
    receiverDepartment: string;
    externalReceiver?: boolean;
    externalDestination?: string;
    cycleNumber?: number;
  };

type SubmissionItemInput =
  Omit<
    DocumentHandoverItem,
    | "id"
    | "receivedQuantity"
    | "receiverNotes"
  >;

type ReturnItemInput = {
  sourceItemId?: string;
  description: string;
  quantity: number;
  notes?: string;
};

type DecisionItemInput = {
  itemId: string;
  receivedQuantity: number;
  receiverNotes?: string;
};

type EvidenceInput = {
  fileId: string;
  fileName: string;
  fileSize: number;
};

const getRecords =
  (): V14DocumentHandover[] =>
    store.getDocumentHandovers() as unknown as
      V14DocumentHandover[];

const saveRecords = (
  records: V14DocumentHandover[]
) => {
  localStorage.setItem(
    HANDOVER_STORAGE_KEY,
    JSON.stringify(records)
  );

  const candidate =
    store as unknown as {
      notify?: () => void;
    };

  candidate.notify?.();
};

const createNotification = (
  notification:
    Omit<AppNotification, "id" | "createdAt" | "isRead">
) => {
  store.addNotification({
    id: `NTF-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 6)}`,
    ...notification,
    isRead: false,
    createdAt: new Date().toISOString(),
  });
};

const itemSummary = (
  items: SubmissionItemInput[]
) =>
  items
    .map(
      (item, index) =>
        `${index + 1}. ${item.documentType} - ${item.description} (${item.physicalForm}, Qty ${item.quantity})${
          item.notes ? `; ${item.notes}` : ""
        }`
    )
    .join(" | ");

const returnItemSummary = (
  items: ReturnItemInput[]
) =>
  items
    .map(
      (item, index) =>
        `${index + 1}. ${item.description} (Qty ${item.quantity})${
          item.notes ? `; ${item.notes}` : ""
        }`
    )
    .join(" | ");

const addAudit = (
  action: string,
  receiptId: string,
  previousStatus: string | undefined,
  newStatus: string | undefined,
  reason: string | undefined,
  fileReference: string | undefined,
  evidence?: EvidenceInput
) => {
  store.addAuditLog(
    "TANDA_TERIMA",
    action,
    "DocumentHandover",
    receiptId,
    previousStatus,
    newStatus,
    reason,
    fileReference,
    evidence
      ? {
          fileId: evidence.fileId,
          fileName: evidence.fileName,
          fileSize: evidence.fileSize,
        }
      : undefined
  );
};

const ensureSubmissionItems = (
  items: SubmissionItemInput[]
) => {
  if (items.length < 1) {
    throw new Error(
      "Minimal terdapat 1 dokumen pada Tanda Terima."
    );
  }

  if (
    items.some(
      item =>
        !item.description.trim() ||
        Number(item.quantity) < 1
    )
  ) {
    throw new Error(
      "Deskripsi dokumen dan jumlah wajib diisi dengan benar."
    );
  }
};

const findReceipt = (
  receiptId: string
) => {
  const records = getRecords();
  const index = records.findIndex(
    item => item.id === receiptId
  );

  if (index < 0) {
    throw new Error(
      "Tanda Terima tidak ditemukan."
    );
  }

  return {
    records,
    index,
    receipt: records[index],
  };
};

const activeInternalReceiver = (
  receiverUserId: string
) => {
  const receiver =
    store
      .getUsers()
      .find(
        user =>
          user.id === receiverUserId &&
          user.status === "Active" &&
          user.role !== "SYSTEM_ADMIN"
      );

  if (!receiver) {
    throw new Error(
      "Penerima internal tidak valid / tidak aktif."
    );
  }

  return receiver;
};

export const getEligibleInternalHandoverReceiversV14 = (
  sender: User = store.getCurrentUser()
): User[] =>
  store
    .getUsers()
    .filter(
      user =>
        user.status === "Active" &&
        user.id !== sender.id &&
        user.role !== "SYSTEM_ADMIN"
    )
    .sort(
      (a, b) =>
        a.name.localeCompare(
          b.name,
          "id"
        )
    );

export const getVisibleDocumentHandoversV14 = (
  user: User = store.getCurrentUser()
): V14DocumentHandover[] => {
  if (user.role === "SYSTEM_ADMIN") {
    return [];
  }

  const records = getRecords();

  if (
    user.role === "TEAM_LEADER_MARKETING_SUPPORT" ||
    user.role === "DEPARTMENT_HEAD_MARKETING_ADMINISTRATION" ||
    user.role === "SUPERVISOR_MARKETING_ADMINISTRATION"
  ) {
    return records;
  }

  const scopedIds =
    new Set(
      store.getSubordinateUserIds(
        user.id
      )
    );

  return records.filter(
    receipt =>
      scopedIds.has(
        receipt.senderUserId
      ) ||
      scopedIds.has(
        receipt.receiverUserId
      )
  );
};

export const createDocumentHandoverV14 = (
  input: {
    receiptId: string;
    handoverDate: string;
    receiverUserId: string;
    externalDestination?: string;
    relatedModule: DocumentHandoverRelatedModule;
    relatedTransactionId?: string;
    relatedDescription?: string;
    items: SubmissionItemInput[];
    evidence: EvidenceInput;
  }
): V14DocumentHandover => {
  const sender = store.getCurrentUser();

  if (sender.role === "SYSTEM_ADMIN") {
    throw new Error(
      "System Admin tidak dapat membuat Tanda Terima."
    );
  }

  if (!input.handoverDate) {
    throw new Error(
      "Tanggal penyerahan wajib diisi."
    );
  }

  ensureSubmissionItems(
    input.items
  );

  const records = getRecords();

  if (
    records.some(
      item => item.id === input.receiptId
    )
  ) {
    throw new Error(
      `Nomor ${input.receiptId} sudah digunakan. Muat ulang halaman lalu coba kembali.`
    );
  }

  const isExternal =
    input.receiverUserId ===
    EXTERNAL_RECEIVER_ID;

  const externalDestination =
    input.externalDestination?.trim() ||
    "";

  if (
    isExternal &&
    !externalDestination
  ) {
    throw new Error(
      "Nama fungsi / unit tujuan wajib diisi untuk Fungsi Lainnya."
    );
  }

  const receiver =
    isExternal
      ? null
      : activeInternalReceiver(
          input.receiverUserId
        );

  const now =
    new Date().toISOString();

  const status:
    DocumentHandoverStatus =
    isExternal
      ? "DITERIMA"
      : "MENUNGGU PENERIMAAN";

  const receipt:
    V14DocumentHandover = {
      id: input.receiptId,
      handoverType:
        "PENYERAHAN DOKUMEN",
      handoverDate:
        input.handoverDate,

      senderUserId:
        sender.id,
      senderName:
        sender.name,
      senderRole:
        sender.role,
      senderUnit:
        sender.unit,
      senderDepartment:
        sender.department,

      receiverUserId:
        isExternal
          ? EXTERNAL_RECEIVER_ID
          : receiver!.id,
      receiverName:
        isExternal
          ? externalDestination
          : receiver!.name,
      receiverRole:
        isExternal
          ? "EXTERNAL_FUNCTION"
          : receiver!.role,
      receiverUnit:
        isExternal
          ? "Fungsi Lainnya"
          : receiver!.unit,
      receiverDepartment:
        isExternal
          ? "Fungsi Lainnya"
          : receiver!.department,

      relatedModule:
        input.relatedModule,
      relatedTransactionId:
        input.relatedTransactionId?.trim() ||
        undefined,
      relatedDescription:
        input.relatedDescription?.trim() ||
        undefined,

      items:
        input.items.map(
          (item, index) => ({
            ...item,
            id:
              `${input.receiptId}-C1-ITEM-${String(
                index + 1
              ).padStart(2, "0")}`,
            receivedQuantity:
              isExternal
                ? Number(item.quantity)
                : undefined,
          })
        ),

      status,
      submittedAt: now,
      submittedByUserId:
        sender.id,
      submittedByName:
        sender.name,

      submissionPhotoFileId:
        input.evidence.fileId,
      submissionPhotoFileName:
        input.evidence.fileName,
      submissionPhotoFileSize:
        input.evidence.fileSize,

      receiverDecisionAt:
        isExternal
          ? now
          : undefined,
      receiverDecisionByUserId:
        isExternal
          ? sender.id
          : undefined,
      receiverDecisionByName:
        isExternal
          ? sender.name
          : undefined,
      receiverDecisionNotes:
        isExternal
          ? `Penyerahan ke Fungsi Lainnya (${externalDestination}) dicatat final tanpa proses acknowledgement di Dashboard Marketing.`
          : undefined,

      externalReceiver:
        isExternal,
      externalDestination:
        isExternal
          ? externalDestination
          : undefined,
      cycleNumber: 1,
    };

  records.unshift(
    receipt
  );

  saveRecords(
    records
  );

  addAudit(
    isExternal
      ? "SUBMIT_EXTERNAL_HANDOVER"
      : "SUBMIT_HANDOVER",
    receipt.id,
    undefined,
    receipt.status,
    isExternal
      ? `${sender.name} menyerahkan dokumen ke Fungsi Lainnya: ${externalDestination}. Registry langsung berstatus DITERIMA.`
      : `${sender.name} menyerahkan dokumen kepada ${receiver!.name}.`,
    itemSummary(
      input.items
    ),
    input.evidence
  );

  if (receiver) {
    createNotification({
      recipientUserId:
        receiver.id,
      title:
        "Dokumen Menunggu Penerimaan",
      message:
        `${sender.name} menyerahkan ${receipt.items.length} item dokumen kepada Anda (${receipt.id}).`,
      linkPath:
        "/tanda-terima",
    });
  }

  return receipt;
};

export const resendDocumentHandoverV14 = (
  receiptId: string,
  input: {
    handoverDate: string;
    items: SubmissionItemInput[];
    evidence: EvidenceInput;
  }
): V14DocumentHandover => {
  const currentUser =
    store.getCurrentUser();

  const {
    records,
    index,
    receipt,
  } = findReceipt(
    receiptId
  );

  if (receipt.externalReceiver) {
    throw new Error(
      "Tanda Terima Fungsi Lainnya sudah final dan tidak menggunakan siklus kirim ulang."
    );
  }

  if (
    receipt.senderUserId !==
    currentUser.id
  ) {
    throw new Error(
      "Hanya pengirim awal yang dapat mengirim ulang registry ini."
    );
  }

  if (
    receipt.status !==
    "DIKEMBALIKAN"
  ) {
    throw new Error(
      "Kirim ulang hanya dapat dilakukan setelah dokumen diterima kembali lengkap."
    );
  }

  if (!input.handoverDate) {
    throw new Error(
      "Tanggal penyerahan ulang wajib diisi."
    );
  }

  ensureSubmissionItems(
    input.items
  );

  const receiver =
    activeInternalReceiver(
      receipt.receiverUserId
    );

  const now =
    new Date().toISOString();

  const cycleNumber =
    Math.max(
      1,
      Number(
        receipt.cycleNumber ||
        1
      )
    ) + 1;

  const updated:
    V14DocumentHandover = {
      ...receipt,
      handoverDate:
        input.handoverDate,
      status:
        "MENUNGGU PENERIMAAN",
      cycleNumber,

      items:
        input.items.map(
          (item, itemIndex) => ({
            ...item,
            id:
              `${receipt.id}-C${cycleNumber}-ITEM-${String(
                itemIndex + 1
              ).padStart(2, "0")}`,
          })
        ),

      submittedAt: now,
      submittedByUserId:
        currentUser.id,
      submittedByName:
        currentUser.name,

      submissionPhotoFileId:
        input.evidence.fileId,
      submissionPhotoFileName:
        input.evidence.fileName,
      submissionPhotoFileSize:
        input.evidence.fileSize,

      receiverDecisionAt:
        undefined,
      receiverDecisionByUserId:
        undefined,
      receiverDecisionByName:
        undefined,
      receiverDecisionNotes:
        undefined,
      receiptPhotoFileId:
        undefined,
      receiptPhotoFileName:
        undefined,
      receiptPhotoFileSize:
        undefined,

      initialDiscrepancyItems:
        undefined,
      initialDiscrepancyResolvedAt:
        undefined,
      initialDiscrepancyResolvedByUserId:
        undefined,
      initialDiscrepancyResolvedByName:
        undefined,
      initialDiscrepancyResolutionNotes:
        undefined,
      initialDiscrepancyResolutionPhotoFileId:
        undefined,
      initialDiscrepancyResolutionPhotoFileName:
        undefined,
      initialDiscrepancyResolutionPhotoFileSize:
        undefined,

      returnItems:
        undefined,
      returnSubmittedAt:
        undefined,
      returnSubmittedByUserId:
        undefined,
      returnSubmittedByName:
        undefined,
      returnPhotoFileId:
        undefined,
      returnPhotoFileName:
        undefined,
      returnPhotoFileSize:
        undefined,
      returnReceiverDecisionAt:
        undefined,
      returnReceiverDecisionByUserId:
        undefined,
      returnReceiverDecisionByName:
        undefined,
      returnReceiverDecisionNotes:
        undefined,
      returnReceiptPhotoFileId:
        undefined,
      returnReceiptPhotoFileName:
        undefined,
      returnReceiptPhotoFileSize:
        undefined,
      returnDiscrepancyItems:
        undefined,
      returnDiscrepancyResolvedAt:
        undefined,
      returnDiscrepancyResolvedByUserId:
        undefined,
      returnDiscrepancyResolvedByName:
        undefined,
      returnDiscrepancyResolutionNotes:
        undefined,
      returnDiscrepancyResolutionPhotoFileId:
        undefined,
      returnDiscrepancyResolutionPhotoFileName:
        undefined,
      returnDiscrepancyResolutionPhotoFileSize:
        undefined,
    };

  records[index] =
    updated;

  saveRecords(
    records
  );

  addAudit(
    "RESUBMIT_HANDOVER",
    updated.id,
    receipt.status,
    updated.status,
    `${currentUser.name} mengirim ulang ${updated.id} kepada ${receiver.name} menggunakan registry yang sama. Siklus ${cycleNumber}.`,
    itemSummary(
      input.items
    ),
    input.evidence
  );

  createNotification({
    recipientUserId:
      receiver.id,
    title:
      "Dokumen Dikirim Ulang",
    message:
      `${currentUser.name} mengirim ulang dokumen untuk ${updated.id}. Mohon konfirmasi penerimaan.`,
    linkPath:
      "/tanda-terima",
  });

  return updated;
};

export const returnDocumentHandoverV14 = (
  receiptId: string,
  input: {
    handoverDate: string;
    items: ReturnItemInput[];
    evidence: EvidenceInput;
  }
): V14DocumentHandover => {
  const currentUser =
    store.getCurrentUser();

  const {
    records,
    index,
    receipt,
  } = findReceipt(
    receiptId
  );

  if (receipt.externalReceiver) {
    throw new Error(
      "Fungsi Lainnya tidak menggunakan proses pengembalian digital."
    );
  }

  if (
    receipt.receiverUserId !==
    currentUser.id
  ) {
    throw new Error(
      "Hanya penerima dokumen yang dapat mengembalikan registry ini."
    );
  }

  if (
    receipt.status !==
    "DITERIMA"
  ) {
    throw new Error(
      "Pengembalian hanya dapat dilakukan setelah dokumen diterima lengkap."
    );
  }

  if (!input.handoverDate) {
    throw new Error(
      "Tanggal pengembalian wajib diisi."
    );
  }

  if (
    input.items.length < 1 ||
    input.items.some(
      item =>
        !item.description.trim() ||
        Number(item.quantity) < 1
    )
  ) {
    throw new Error(
      "Daftar dokumen pengembalian wajib diisi dengan benar."
    );
  }

  const now =
    new Date().toISOString();

  const returnItems:
    DocumentHandoverReturnItem[] =
    input.items.map(
      (item, itemIndex) => ({
        id:
          `${receipt.id}-C${receipt.cycleNumber || 1}-RETURN-${Date.now()}-${String(
            itemIndex + 1
          ).padStart(2, "0")}`,
        sourceItemId:
          item.sourceItemId,
        description:
          item.description.trim(),
        quantity:
          Number(item.quantity),
        notes:
          item.notes?.trim() ||
          undefined,
      })
    );

  const updated:
    V14DocumentHandover = {
      ...receipt,
      status:
        "MENUNGGU KONFIRMASI PENGEMBALIAN",
      returnItems,
      returnSubmittedAt:
        now,
      returnSubmittedByUserId:
        currentUser.id,
      returnSubmittedByName:
        currentUser.name,
      returnPhotoFileId:
        input.evidence.fileId,
      returnPhotoFileName:
        input.evidence.fileName,
      returnPhotoFileSize:
        input.evidence.fileSize,
      returnReceiverDecisionAt:
        undefined,
      returnReceiverDecisionByUserId:
        undefined,
      returnReceiverDecisionByName:
        undefined,
      returnReceiverDecisionNotes:
        undefined,
      returnReceiptPhotoFileId:
        undefined,
      returnReceiptPhotoFileName:
        undefined,
      returnReceiptPhotoFileSize:
        undefined,
    };

  records[index] =
    updated;

  saveRecords(
    records
  );

  addAudit(
    "RETURN_HANDOVER_SUBMITTED",
    updated.id,
    receipt.status,
    updated.status,
    `${currentUser.name} mengembalikan dokumen kepada ${receipt.senderName}.`,
    returnItemSummary(
      input.items
    ),
    input.evidence
  );

  createNotification({
    recipientUserId:
      receipt.senderUserId,
    title:
      "Pengembalian Dokumen Menunggu Konfirmasi",
    message:
      `${currentUser.name} mengembalikan dokumen untuk ${updated.id}. Mohon konfirmasi penerimaan kembali.`,
    linkPath:
      "/tanda-terima",
  });

  return updated;
};

export const confirmDocumentHandoverV14 = (
  receiptId: string,
  input: {
    status:
      | "DITERIMA"
      | "SELISIH DOKUMEN";
    items: DecisionItemInput[];
    notes?: string;
    evidence?: EvidenceInput;
  }
): V14DocumentHandover => {
  const currentUser =
    store.getCurrentUser();

  const {
    records,
    index,
    receipt,
  } = findReceipt(
    receiptId
  );

  if (
    receipt.externalReceiver ||
    receipt.status !==
      "MENUNGGU PENERIMAAN" ||
    receipt.receiverUserId !==
      currentUser.id
  ) {
    throw new Error(
      "Tanda Terima ini tidak dapat diproses oleh akun ini."
    );
  }

  const decisionMap =
    new Map(
      input.items.map(
        item => [
          item.itemId,
          item,
        ]
      )
    );

  const updatedItems =
    receipt.items.map(
      item => {
        const decision =
          decisionMap.get(
            item.id
          );

        return {
          ...item,
          receivedQuantity:
            Math.max(
              0,
              Number(
                decision?.receivedQuantity ??
                0
              )
            ),
          receiverNotes:
            decision?.receiverNotes?.trim() ||
            undefined,
        };
      }
    );

  if (
    input.status === "DITERIMA" &&
    updatedItems.some(
      item =>
        Number(
          item.receivedQuantity
        ) !==
        Number(item.quantity)
    )
  ) {
    throw new Error(
      "Status DITERIMA hanya dapat dipilih jika seluruh jumlah dokumen diterima lengkap."
    );
  }

  const discrepancySnapshot:
    DocumentHandoverDiscrepancySnapshotItem[] | undefined =
    input.status ===
      "SELISIH DOKUMEN"
      ? updatedItems.map(
          item => ({
            itemId:
              item.id,
            expectedQuantity:
              Number(item.quantity),
            receivedQuantity:
              Number(
                item.receivedQuantity ||
                0
              ),
            receiverNotes:
              item.receiverNotes,
          })
        )
      : undefined;

  const now =
    new Date().toISOString();

  const updated:
    V14DocumentHandover = {
      ...receipt,
      items:
        updatedItems,
      status:
        input.status,
      receiverDecisionAt:
        now,
      receiverDecisionByUserId:
        currentUser.id,
      receiverDecisionByName:
        currentUser.name,
      receiverDecisionNotes:
        input.notes?.trim() ||
        undefined,
      receiptPhotoFileId:
        input.evidence?.fileId,
      receiptPhotoFileName:
        input.evidence?.fileName,
      receiptPhotoFileSize:
        input.evidence?.fileSize,
      initialDiscrepancyItems:
        discrepancySnapshot,
    };

  records[index] =
    updated;

  saveRecords(
    records
  );

  addAudit(
    input.status === "DITERIMA"
      ? "CONFIRM_RECEIVED"
      : "REPORT_DISCREPANCY",
    updated.id,
    receipt.status,
    updated.status,
    input.notes?.trim() ||
      `${currentUser.name} memproses penerimaan dokumen.`,
    updatedItems
      .map(
        item =>
          `${item.description}: ${item.receivedQuantity ?? 0}/${item.quantity}`
      )
      .join(" | "),
    input.evidence
  );

  createNotification({
    recipientUserId:
      receipt.senderUserId,
    title:
      input.status === "DITERIMA"
        ? "Dokumen Telah Diterima"
        : "Selisih Dokumen Dilaporkan",
    message:
      `${currentUser.name} memproses ${updated.id} dengan status ${updated.status}.`,
    linkPath:
      "/tanda-terima",
  });

  return updated;
};

export const confirmDocumentReturnV14 = (
  receiptId: string,
  input: {
    status:
      | "DIKEMBALIKAN"
      | "SELISIH PENGEMBALIAN";
    items: DecisionItemInput[];
    notes?: string;
    evidence?: EvidenceInput;
  }
): V14DocumentHandover => {
  const currentUser =
    store.getCurrentUser();

  const {
    records,
    index,
    receipt,
  } = findReceipt(
    receiptId
  );

  if (
    receipt.status !==
      "MENUNGGU KONFIRMASI PENGEMBALIAN" ||
    receipt.senderUserId !==
      currentUser.id ||
    !receipt.returnItems?.length
  ) {
    throw new Error(
      "Pengembalian ini tidak dapat diproses oleh akun ini."
    );
  }

  const decisionMap =
    new Map(
      input.items.map(
        item => [
          item.itemId,
          item,
        ]
      )
    );

  const updatedReturnItems =
    receipt.returnItems.map(
      item => {
        const decision =
          decisionMap.get(
            item.id
          );

        return {
          ...item,
          receivedQuantity:
            Math.max(
              0,
              Number(
                decision?.receivedQuantity ??
                0
              )
            ),
          receiverNotes:
            decision?.receiverNotes?.trim() ||
            undefined,
        };
      }
    );

  if (
    input.status === "DIKEMBALIKAN" &&
    updatedReturnItems.some(
      item =>
        Number(
          item.receivedQuantity
        ) !==
        Number(item.quantity)
    )
  ) {
    throw new Error(
      "Status DIKEMBALIKAN hanya dapat dipilih jika seluruh dokumen pengembalian diterima lengkap."
    );
  }

  const discrepancySnapshot:
    DocumentHandoverDiscrepancySnapshotItem[] | undefined =
    input.status ===
      "SELISIH PENGEMBALIAN"
      ? updatedReturnItems.map(
          item => ({
            itemId:
              item.id,
            expectedQuantity:
              Number(item.quantity),
            receivedQuantity:
              Number(
                item.receivedQuantity ||
                0
              ),
            receiverNotes:
              item.receiverNotes,
          })
        )
      : undefined;

  const now =
    new Date().toISOString();

  const updated:
    V14DocumentHandover = {
      ...receipt,
      status:
        input.status,
      returnItems:
        updatedReturnItems,
      returnReceiverDecisionAt:
        now,
      returnReceiverDecisionByUserId:
        currentUser.id,
      returnReceiverDecisionByName:
        currentUser.name,
      returnReceiverDecisionNotes:
        input.notes?.trim() ||
        undefined,
      returnReceiptPhotoFileId:
        input.evidence?.fileId,
      returnReceiptPhotoFileName:
        input.evidence?.fileName,
      returnReceiptPhotoFileSize:
        input.evidence?.fileSize,
      returnDiscrepancyItems:
        discrepancySnapshot,
    };

  records[index] =
    updated;

  saveRecords(
    records
  );

  addAudit(
    input.status === "DIKEMBALIKAN"
      ? "RETURN_HANDOVER_CONFIRMED"
      : "RETURN_HANDOVER_DISCREPANCY",
    updated.id,
    receipt.status,
    updated.status,
    input.notes?.trim() ||
      `${currentUser.name} memproses penerimaan kembali dokumen.`,
    updatedReturnItems
      .map(
        item =>
          `${item.description}: ${item.receivedQuantity ?? 0}/${item.quantity}`
      )
      .join(" | "),
    input.evidence
  );

  createNotification({
    recipientUserId:
      receipt.returnSubmittedByUserId ||
      receipt.receiverUserId,
    title:
      input.status === "DIKEMBALIKAN"
        ? "Pengembalian Dokumen Dikonfirmasi"
        : "Selisih Pengembalian Dilaporkan",
    message:
      `${currentUser.name} memproses pengembalian ${updated.id} dengan status ${updated.status}.`,
    linkPath:
      "/tanda-terima",
  });

  return updated;
};

export const resolveDocumentHandoverDiscrepancyV14 = (
  receiptId: string,
  input: {
    notes: string;
    evidence: EvidenceInput;
  }
): V14DocumentHandover => {
  const currentUser =
    store.getCurrentUser();

  const {
    records,
    index,
    receipt,
  } = findReceipt(
    receiptId
  );

  const notes =
    input.notes.trim();

  if (!notes) {
    throw new Error(
      "Catatan penyelesaian selisih wajib diisi."
    );
  }

  const now =
    new Date().toISOString();

  if (
    receipt.status ===
    "SELISIH DOKUMEN"
  ) {
    if (
      receipt.receiverUserId !==
      currentUser.id
    ) {
      throw new Error(
        "Hanya penerima dokumen yang dapat menyelesaikan selisih penerimaan."
      );
    }

    const updated:
      V14DocumentHandover = {
      ...receipt,
      status:
        "DITERIMA",
      initialDiscrepancyResolvedAt:
        now,
      initialDiscrepancyResolvedByUserId:
        currentUser.id,
      initialDiscrepancyResolvedByName:
        currentUser.name,
      initialDiscrepancyResolutionNotes:
        notes,
      initialDiscrepancyResolutionPhotoFileId:
        input.evidence.fileId,
      initialDiscrepancyResolutionPhotoFileName:
        input.evidence.fileName,
      initialDiscrepancyResolutionPhotoFileSize:
        input.evidence.fileSize,
      items:
        receipt.items.map(
          item => ({
            ...item,
            receivedQuantity:
              Number(item.quantity),
          })
        ),
    };

    records[index] =
      updated;

    saveRecords(
      records
    );

    addAudit(
      "RESOLVE_DOCUMENT_DISCREPANCY",
      updated.id,
      receipt.status,
      updated.status,
      notes,
      "Selisih dokumen diselesaikan dan jumlah diterima disamakan dengan jumlah penyerahan.",
      input.evidence
    );

    createNotification({
      recipientUserId:
        receipt.senderUserId,
      title:
        "Selisih Dokumen Diselesaikan",
      message:
        `${currentUser.name} menyelesaikan selisih pada ${updated.id}.`,
      linkPath:
        "/tanda-terima",
    });

    return updated;
  }

  if (
    receipt.status ===
    "SELISIH PENGEMBALIAN"
  ) {
    if (
      receipt.senderUserId !==
      currentUser.id ||
      !receipt.returnItems?.length
    ) {
      throw new Error(
        "Hanya penerima kembali / pengirim awal yang dapat menyelesaikan selisih pengembalian."
      );
    }

    const updated:
      V14DocumentHandover = {
      ...receipt,
      status:
        "DIKEMBALIKAN",
      returnDiscrepancyResolvedAt:
        now,
      returnDiscrepancyResolvedByUserId:
        currentUser.id,
      returnDiscrepancyResolvedByName:
        currentUser.name,
      returnDiscrepancyResolutionNotes:
        notes,
      returnDiscrepancyResolutionPhotoFileId:
        input.evidence.fileId,
      returnDiscrepancyResolutionPhotoFileName:
        input.evidence.fileName,
      returnDiscrepancyResolutionPhotoFileSize:
        input.evidence.fileSize,
      returnItems:
        receipt.returnItems.map(
          item => ({
            ...item,
            receivedQuantity:
              Number(item.quantity),
          })
        ),
    };

    records[index] =
      updated;

    saveRecords(
      records
    );

    addAudit(
      "RESOLVE_RETURN_DISCREPANCY",
      updated.id,
      receipt.status,
      updated.status,
      notes,
      "Selisih pengembalian diselesaikan dan dokumen dinyatakan kembali lengkap.",
      input.evidence
    );

    createNotification({
      recipientUserId:
        receipt.returnSubmittedByUserId ||
        receipt.receiverUserId,
      title:
        "Selisih Pengembalian Diselesaikan",
      message:
        `${currentUser.name} menyelesaikan selisih pengembalian ${updated.id}.`,
      linkPath:
        "/tanda-terima",
    });

    return updated;
  }

  throw new Error(
    "Tanda Terima tidak sedang memiliki selisih aktif."
  );
};

export const rejectDocumentHandoverV14 = (
  receiptId: string,
  reason: string
): V14DocumentHandover => {
  const currentUser =
    store.getCurrentUser();

  const {
    records,
    index,
    receipt,
  } = findReceipt(
    receiptId
  );

  if (
    receipt.status !==
      "MENUNGGU PENERIMAAN" ||
    receipt.receiverUserId !==
      currentUser.id
  ) {
    throw new Error(
      "Tanda Terima tidak dapat ditolak oleh akun ini."
    );
  }

  const trimmedReason =
    reason.trim();

  if (!trimmedReason) {
    throw new Error(
      "Alasan penolakan wajib diisi."
    );
  }

  const now =
    new Date().toISOString();

  const updated:
    V14DocumentHandover = {
    ...receipt,
    status:
      "DITOLAK",
    receiverDecisionAt:
      now,
    receiverDecisionByUserId:
      currentUser.id,
    receiverDecisionByName:
      currentUser.name,
    receiverDecisionNotes:
      trimmedReason,
  };

  records[index] =
    updated;

  saveRecords(
    records
  );

  addAudit(
    "REJECT_HANDOVER",
    updated.id,
    receipt.status,
    updated.status,
    trimmedReason,
    undefined
  );

  createNotification({
    recipientUserId:
      receipt.senderUserId,
    title:
      "Penerimaan Dokumen Ditolak",
    message:
      `${currentUser.name} menolak ${updated.id}. Alasan: ${trimmedReason}`,
    linkPath:
      "/tanda-terima",
  });

  return updated;
};

export const cancelDocumentHandoverV14 = (
  receiptId: string,
  reason: string
): V14DocumentHandover => {
  const currentUser =
    store.getCurrentUser();

  const {
    records,
    index,
    receipt,
  } = findReceipt(
    receiptId
  );

  if (
    receipt.status !==
      "MENUNGGU PENERIMAAN" ||
    receipt.senderUserId !==
      currentUser.id
  ) {
    throw new Error(
      "Hanya pengirim yang dapat membatalkan Tanda Terima sebelum ada keputusan penerima."
    );
  }

  const trimmedReason =
    reason.trim();

  if (!trimmedReason) {
    throw new Error(
      "Alasan pembatalan wajib diisi."
    );
  }

  const now =
    new Date().toISOString();

  const updated:
    V14DocumentHandover = {
    ...receipt,
    status:
      "DIBATALKAN",
    cancelledAt:
      now,
    cancelledByUserId:
      currentUser.id,
    cancelledByName:
      currentUser.name,
    cancellationReason:
      trimmedReason,
  };

  records[index] =
    updated;

  saveRecords(
    records
  );

  addAudit(
    "CANCEL_HANDOVER",
    updated.id,
    receipt.status,
    updated.status,
    trimmedReason,
    undefined
  );

  createNotification({
    recipientUserId:
      receipt.receiverUserId,
    title:
      "Tanda Terima Dibatalkan",
    message:
      `${currentUser.name} membatalkan ${updated.id}.`,
    linkPath:
      "/tanda-terima",
  });

  return updated;
};

export const getDocumentHandoverHistoryV14 = (
  receipt:
    V14DocumentHandover,
  auditLogs:
    AuditLog[]
): AuditLog[] => {
  const matching =
    auditLogs
      .filter(
        log =>
          log.module ===
            "TANDA_TERIMA" &&
          log.recordId ===
            receipt.id
      )
      .sort(
        (a, b) =>
          new Date(
            a.timestamp
          ).getTime() -
          new Date(
            b.timestamp
          ).getTime()
      );

  if (matching.length > 0) {
    return matching;
  }

  const fallback:
    AuditLog[] = [
    {
      id:
        `${receipt.id}-FALLBACK-SUBMIT`,
      timestamp:
        receipt.submittedAt,
      userId:
        receipt.submittedByUserId ||
        receipt.senderUserId,
      userName:
        receipt.submittedByName ||
        receipt.senderName,
      userRole:
        receipt.senderRole,
      module:
        "TANDA_TERIMA",
      action:
        receipt.externalReceiver
          ? "SUBMIT_EXTERNAL_HANDOVER"
          : "SUBMIT_HANDOVER",
      recordType:
        "DocumentHandover",
      recordId:
        receipt.id,
      newStatus:
        receipt.externalReceiver
          ? "DITERIMA"
          : "MENUNGGU PENERIMAAN",
      reason:
        `${receipt.senderName} menyerahkan dokumen kepada ${receipt.receiverName}.`,
      evidenceFileId:
        receipt.submissionPhotoFileId,
      evidenceFileName:
        receipt.submissionPhotoFileName,
      evidenceFileSize:
        receipt.submissionPhotoFileSize,
    },
  ];

  if (
    receipt.receiverDecisionAt &&
    !receipt.externalReceiver
  ) {
    fallback.push({
      id:
        `${receipt.id}-FALLBACK-RECEIVE`,
      timestamp:
        receipt.receiverDecisionAt,
      userId:
        receipt.receiverDecisionByUserId ||
        receipt.receiverUserId,
      userName:
        receipt.receiverDecisionByName ||
        receipt.receiverName,
      userRole:
        receipt.receiverRole ===
        "EXTERNAL_FUNCTION"
          ? receipt.senderRole
          : receipt.receiverRole,
      module:
        "TANDA_TERIMA",
      action:
        receipt.status ===
          "SELISIH DOKUMEN"
          ? "REPORT_DISCREPANCY"
          : "CONFIRM_RECEIVED",
      recordType:
        "DocumentHandover",
      recordId:
        receipt.id,
      previousStatus:
        "MENUNGGU PENERIMAAN",
      newStatus:
        receipt.status,
      reason:
        receipt.receiverDecisionNotes,
      evidenceFileId:
        receipt.receiptPhotoFileId,
      evidenceFileName:
        receipt.receiptPhotoFileName,
      evidenceFileSize:
        receipt.receiptPhotoFileSize,
    });
  }

  if (receipt.returnSubmittedAt) {
    fallback.push({
      id:
        `${receipt.id}-FALLBACK-RETURN`,
      timestamp:
        receipt.returnSubmittedAt,
      userId:
        receipt.returnSubmittedByUserId ||
        receipt.receiverUserId,
      userName:
        receipt.returnSubmittedByName ||
        receipt.receiverName,
      userRole:
        receipt.receiverRole ===
        "EXTERNAL_FUNCTION"
          ? receipt.senderRole
          : receipt.receiverRole,
      module:
        "TANDA_TERIMA",
      action:
        "RETURN_HANDOVER_SUBMITTED",
      recordType:
        "DocumentHandover",
      recordId:
        receipt.id,
      newStatus:
        "MENUNGGU KONFIRMASI PENGEMBALIAN",
      evidenceFileId:
        receipt.returnPhotoFileId,
      evidenceFileName:
        receipt.returnPhotoFileName,
      evidenceFileSize:
        receipt.returnPhotoFileSize,
    });
  }

  if (receipt.returnReceiverDecisionAt) {
    fallback.push({
      id:
        `${receipt.id}-FALLBACK-RETURN-RECEIVE`,
      timestamp:
        receipt.returnReceiverDecisionAt,
      userId:
        receipt.returnReceiverDecisionByUserId ||
        receipt.senderUserId,
      userName:
        receipt.returnReceiverDecisionByName ||
        receipt.senderName,
      userRole:
        receipt.senderRole,
      module:
        "TANDA_TERIMA",
      action:
        receipt.status ===
          "SELISIH PENGEMBALIAN"
          ? "RETURN_HANDOVER_DISCREPANCY"
          : "RETURN_HANDOVER_CONFIRMED",
      recordType:
        "DocumentHandover",
      recordId:
        receipt.id,
      previousStatus:
        "MENUNGGU KONFIRMASI PENGEMBALIAN",
      newStatus:
        receipt.status,
      reason:
        receipt.returnReceiverDecisionNotes,
      evidenceFileId:
        receipt.returnReceiptPhotoFileId,
      evidenceFileName:
        receipt.returnReceiptPhotoFileName,
      evidenceFileSize:
        receipt.returnReceiptPhotoFileSize,
    });
  }

  return fallback.sort(
    (a, b) =>
      new Date(
        a.timestamp
      ).getTime() -
      new Date(
        b.timestamp
      ).getTime()
  );
};

export const waitForDocumentHandoverV14Sync =
  async () => {
    await waitForCentralBusinessStorageSync(
      "pertalife_document_handovers"
    );

    await waitForCentralBusinessStorageSync(
      "pertalife_audit_logs"
    );

    await waitForCentralBusinessStorageSync(
      "pertalife_notifications"
    );
  };
