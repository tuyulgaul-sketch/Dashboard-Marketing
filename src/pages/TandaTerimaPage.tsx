import React, { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { store } from '@/services/store';
import {
  AuditLog,
  DocumentHandover,
  DocumentHandoverItem,
  DocumentHandoverRelatedModule,
  DocumentHandoverType,
  User,
} from '@/types';
import {
  saveDocumentHandoverFile,
  openDocumentHandoverFile,
  downloadDocumentHandoverFile,
} from '@/services/documentHandoverFileStorage';
import { formatSlaDueDate, getSlaState } from '@/utils/slaGovernance';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileText,
  Plus,
  Search,
  Send,
  X,
} from 'lucide-react';

type ReceiptFilter = 'ALL' | 'TO_RECEIVE' | 'SENT' | 'RECEIVED' | 'DISCREPANCY' | 'CLOSED';

type DraftItem = {
  sourceItemId?: string;
  documentType: DocumentHandoverItem['documentType'];
  description: string;
  physicalForm: DocumentHandoverItem['physicalForm'];
  quantity: number;
  notes: string;
};

type DecisionItem = {
  itemId: string;
  receivedQuantity: number;
  receiverNotes: string;
};

const MARKETING_ROLES = new Set([
  'DIRECTOR_MARKETING',
  'ADVISOR_MARKETING_DIRECTOR',
  'VP_CAPTIVE_MARKETING',
  'VP_CORPORATE_RETAIL_MARKETING',
  'DEPARTMENT_HEAD_MARKETING',
  'SUPERVISOR_MARKETING',
  'STAFF_MARKETING',
]);

const MARKETING_ADMIN_ROLES = new Set([
  'DEPARTMENT_HEAD_MARKETING_ADMINISTRATION',
  'SUPERVISOR_MARKETING_ADMINISTRATION',
  'STAFF_MARKETING_ADMINISTRATION',
]);

const DOCUMENT_TYPES: DocumentHandoverItem['documentType'][] = [
  'Tagihan / Invoice',
  'Kwitansi',
  'Polis',
  'SPAJ',
  'SPAK',
  'Surat',
  'Proposal',
  'Dokumen Closing',
  'Lampiran',
  'Lainnya',
];

const PHYSICAL_FORMS: DocumentHandoverItem['physicalForm'][] = [
  'Asli',
  'Copy',
  'Legalized Copy',
];

const emptyItem = (): DraftItem => ({
  documentType: 'Tagihan / Invoice',
  description: '',
  physicalForm: 'Asli',
  quantity: 1,
  notes: '',
});

const formatDateOnly = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

const formatDateTime = (value?: string) =>
  value
    ? new Date(value).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-';

const statusClass = (status: DocumentHandover['status']) => {
  if (status === 'DITERIMA') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (status === 'DIKEMBALIKAN') {
    return 'border-violet-200 bg-violet-50 text-violet-700';
  }

  if (
    status === 'SELISIH DOKUMEN' ||
    status === 'SELISIH PENGEMBALIAN'
  ) {
    return 'border-amber-200 bg-amber-50 text-amber-800';
  }

  if (status === 'MENUNGGU KONFIRMASI PENGEMBALIAN') {
    return 'border-violet-200 bg-violet-50 text-violet-700';
  }

  if (status === 'DITOLAK' || status === 'DIBATALKAN') {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }

  return 'border-blue-200 bg-blue-50 text-blue-700';
};

const SlaBadge: React.FC<{ receipt: DocumentHandover }> = ({ receipt }) => {
  if (receipt.status !== 'MENUNGGU PENERIMAAN') return null;

  const state = getSlaState(receipt.submittedAt);
  const cls =
    state === 'OVERDUE'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : state === 'DUE_TODAY'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-emerald-200 bg-emerald-50 text-emerald-700';

  return (
    <span className={`rounded-md border px-2 py-1 text-[10px] font-bold ${cls}`}>
      {state === 'OVERDUE' ? 'OVERDUE' : state === 'DUE_TODAY' ? 'DUE TODAY' : 'ON SLA'} · due{' '}
      {formatSlaDueDate(receipt.submittedAt)}
    </span>
  );
};

const TandaTerimaPage: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User>(store.getCurrentUser());
  const [receipts, setReceipts] = useState<DocumentHandover[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [filter, setFilter] = useState<ReceiptFilter>('ALL');
  const [search, setSearch] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [detailReceipt, setDetailReceipt] = useState<DocumentHandover | null>(null);
  const [receiveReceipt, setReceiveReceipt] = useState<DocumentHandover | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [handoverType, setHandoverType] = useState<DocumentHandoverType>('PENYERAHAN DOKUMEN');
  const [handoverDate, setHandoverDate] = useState(new Date().toISOString().slice(0, 10));
  const [receiverId, setReceiverId] = useState('');
  const [relatedModule, setRelatedModule] = useState<DocumentHandoverRelatedModule>('NONE');
  const [relatedTransactionId, setRelatedTransactionId] = useState('');
  const [relatedDescription, setRelatedDescription] = useState('');
  const [relatedReceiptId, setRelatedReceiptId] = useState('');
  const [draftItems, setDraftItems] = useState<DraftItem[]>([emptyItem()]);
  const [handoverPhoto, setHandoverPhoto] = useState<File | null>(null);

  const [decisionItems, setDecisionItems] = useState<DecisionItem[]>([]);
  const [receiptPhoto, setReceiptPhoto] = useState<File | null>(null);
  const [receiverNotes, setReceiverNotes] = useState('');

  useEffect(() => {
    const refresh = () => {
      const user = store.getCurrentUser();
      setCurrentUser(user);
      setReceipts(store.getVisibleDocumentHandovers(user));
      setAuditLogs(store.getAuditLogs());
    };

    refresh();
    return store.subscribe(refresh);
  }, []);

  const canAccess =
    MARKETING_ROLES.has(currentUser.role) ||
    MARKETING_ADMIN_ROLES.has(currentUser.role) ||
    currentUser.role === 'TEAM_LEADER_MARKETING_SUPPORT';

  const canCreate = store.canCreateDocumentHandover(currentUser);

  const getEffectiveStatus = (receipt: DocumentHandover): DocumentHandover['status'] => {
    if (
      receipt.status === 'DITERIMA' &&
      returnedReceiptIds.has(receipt.id)
    ) {
      return 'DIKEMBALIKAN';
    }

    return receipt.status;
  };

  const getDocumentPosition = (receipt: DocumentHandover) => {
    const status = getEffectiveStatus(receipt);

    if (status === 'MENUNGGU PENERIMAAN') {
      return {
        primary: receipt.receiverName,
        secondary: 'Dalam proses penyerahan',
      };
    }

    if (
      status === 'DITERIMA' ||
      status === 'SELISIH DOKUMEN'
    ) {
      return {
        primary: receipt.receiverName,
        secondary:
          status === 'SELISIH DOKUMEN'
            ? 'Perlu cek selisih dokumen'
            : 'Dokumen berada di penerima',
      };
    }

    if (status === 'MENUNGGU KONFIRMASI PENGEMBALIAN') {
      return {
        primary: receipt.senderName,
        secondary: 'Dalam proses pengembalian',
      };
    }

    if (
      status === 'DIKEMBALIKAN' ||
      status === 'SELISIH PENGEMBALIAN'
    ) {
      return {
        primary: receipt.senderName,
        secondary:
          status === 'SELISIH PENGEMBALIAN'
            ? 'Perlu cek selisih pengembalian'
            : 'Dokumen sudah kembali',
      };
    }

    return {
      primary: receipt.senderName,
      secondary: 'Dokumen pada pihak pengirim',
    };
  };

  const eligibleReceivers = useMemo(
    () => store.getEligibleDocumentHandoverReceivers(currentUser),
    [currentUser, receipts]
  );

  const returnedReceiptIds = useMemo(
    () =>
      new Set(
        auditLogs
          .filter(
            log =>
              log.module === 'TANDA_TERIMA' &&
              log.action === 'RETURN_HANDOVER'
          )
          .map(log => log.recordId)
      ),
    [auditLogs]
  );

  const relationOptions = useMemo(() => {
    if (relatedModule === 'PIPELINE') {
      return store.getPipelines().map(p => ({ id: p.id, label: `${p.id} · ${p.customerName} · ${p.productName}` }));
    }
    if (relatedModule === 'BOOKING') {
      return store.getBookings().map(b => ({ id: b.id, label: `${b.id} · ${b.customerName} · ${b.productName}` }));
    }
    if (relatedModule === 'REIMBURSEMENT') {
      return store.getReimbursements().map(r => ({ id: r.id, label: `${r.id} · ${r.companyName} · ${r.userName}` }));
    }
    return [];
  }, [relatedModule, receipts]);

  const resetCreate = () => {
    setHandoverType('PENYERAHAN DOKUMEN');
    setHandoverDate(new Date().toISOString().slice(0, 10));
    setReceiverId('');
    setRelatedModule('NONE');
    setRelatedTransactionId('');
    setRelatedDescription('');
    setRelatedReceiptId('');
    setDraftItems([emptyItem()]);
    setHandoverPhoto(null);
  };

  const openCreate = () => {
    resetCreate();
    setCreateOpen(true);
  };

  const applyReturnReceipt = (receiptId: string) => {
    setRelatedReceiptId(receiptId);
    const original = receipts.find(item => item.id === receiptId);
    if (!original) return;

    setReceiverId(original.senderUserId);
    setRelatedModule(original.relatedModule);
    setRelatedTransactionId(original.relatedTransactionId || '');
    setRelatedDescription(`Pengembalian dari ${original.id}`);
    setDraftItems(
      original.items
        .filter(
          item =>
            Number(item.receivedQuantity ?? item.quantity) > 0
        )
        .map(item => ({
          sourceItemId: item.id,
          documentType: item.documentType,
          description: item.description,
          physicalForm: item.physicalForm,
          quantity: Math.max(
            1,
            Number(item.receivedQuantity ?? item.quantity)
          ),
          notes: `Pengembalian dari ${original.id}`,
        }))
    );
  };

  const openReturn = (receipt: DocumentHandover) => {
    resetCreate();
    setHandoverType('PENGEMBALIAN DOKUMEN');
    applyReturnReceipt(receipt.id);
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    if (!handoverPhoto) {
      alert(
        handoverType === 'PENGEMBALIAN DOKUMEN'
          ? 'Foto bukti pengembalian wajib diupload.'
          : 'Foto bukti penyerahan wajib diupload.'
      );
      return;
    }

    if (!receiverId) {
      alert('Penerima wajib dipilih.');
      return;
    }

    try {
      setSubmitting(true);

      if (handoverType === 'PENGEMBALIAN DOKUMEN') {
        if (!relatedReceiptId) {
          throw new Error(
            'Tanda Terima yang akan dikembalikan tidak ditemukan.'
          );
        }

        const fileId =
          `TRM-RETURN-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 6)}`;

        await saveDocumentHandoverFile({
          id: fileId,
          transactionId: relatedReceiptId,
          fileName: handoverPhoto.name,
          fileType: handoverPhoto.type || 'image/*',
          fileSize: handoverPhoto.size,
          uploadedByUserId: currentUser.id,
          uploadedByName: currentUser.name,
          uploadedAt: new Date().toISOString(),
          senderUserId: currentUser.id,
          receiverUserId: receiverId,
          blob: handoverPhoto,
        });

        const receipt = store.returnDocumentHandover(
          relatedReceiptId,
          {
            handoverDate,
            items: draftItems.map(item => ({
              sourceItemId: item.sourceItemId,
              description: item.description.trim(),
              quantity: Number(item.quantity),
              notes: item.notes.trim() || undefined,
            })),
            photoFileId: fileId,
            photoFileName: handoverPhoto.name,
            photoFileSize: handoverPhoto.size,
          }
        );

        setCreateOpen(false);
        resetCreate();

        alert(
          `Pengembalian ${receipt.id} dikirim dan menunggu konfirmasi penerimaan kembali.`
        );

        return;
      }

      const receiptId =
        store.getNextDocumentHandoverId(handoverDate);

      const fileId =
        `TRM-SUBMIT-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 6)}`;

      await saveDocumentHandoverFile({
        id: fileId,
        transactionId: receiptId,
        fileName: handoverPhoto.name,
        fileType: handoverPhoto.type || 'image/*',
        fileSize: handoverPhoto.size,
        uploadedByUserId: currentUser.id,
        uploadedByName: currentUser.name,
        uploadedAt: new Date().toISOString(),
        senderUserId: currentUser.id,
        receiverUserId: receiverId,
        blob: handoverPhoto,
      });

      const receipt = store.createDocumentHandover({
        receiptId,
        handoverType,
        handoverDate,
        receiverUserId: receiverId,
        relatedModule,
        relatedTransactionId:
          relatedTransactionId || undefined,
        relatedDescription:
          relatedDescription.trim() || undefined,
        relatedReceiptId:
          relatedReceiptId || undefined,
        submissionPhotoFileId: fileId,
        submissionPhotoFileName: handoverPhoto.name,
        submissionPhotoFileSize: handoverPhoto.size,
        items: draftItems.map(item => ({
          documentType: item.documentType,
          description: item.description.trim(),
          physicalForm: item.physicalForm,
          quantity: Number(item.quantity),
          notes: item.notes.trim() || undefined,
        })),
      });

      setCreateOpen(false);
      resetCreate();

      alert(
        `${receipt.id} berhasil dibuat dan dikirim ke ${receipt.receiverName}.`
      );
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : 'Gagal memproses Tanda Terima.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const openReceive = (receipt: DocumentHandover) => {
    setReceiveReceipt(receipt);

    const sourceItems =
      receipt.status === 'MENUNGGU KONFIRMASI PENGEMBALIAN'
        ? receipt.returnItems || []
        : receipt.items;

    setDecisionItems(
      sourceItems.map(item => ({
        itemId: item.id,
        receivedQuantity: item.quantity,
        receiverNotes: '',
      }))
    );

    setReceiptPhoto(null);
    setReceiverNotes('');
  };

  const submitDecision = async (
    status:
      | 'DITERIMA'
      | 'SELISIH DOKUMEN'
      | 'DIKEMBALIKAN'
      | 'SELISIH PENGEMBALIAN'
  ) => {
    if (!receiveReceipt) return;

    try {
      setSubmitting(true);

      let fileId: string | undefined;

      if (receiptPhoto) {
        fileId =
          `TRM-ACK-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 6)}`;

        await saveDocumentHandoverFile({
          id: fileId,
          transactionId: receiveReceipt.id,
          fileName: receiptPhoto.name,
          fileType: receiptPhoto.type || 'image/*',
          fileSize: receiptPhoto.size,
          uploadedByUserId: currentUser.id,
          uploadedByName: currentUser.name,
          uploadedAt: new Date().toISOString(),
          blob: receiptPhoto,
        });
      }

      if (
        receiveReceipt.status ===
        'MENUNGGU KONFIRMASI PENGEMBALIAN'
      ) {
        store.confirmDocumentReturn(
          receiveReceipt.id,
          {
            status:
              status === 'SELISIH PENGEMBALIAN'
                ? 'SELISIH PENGEMBALIAN'
                : 'DIKEMBALIKAN',
            items: decisionItems,
            photoFileId: fileId,
            photoFileName: receiptPhoto?.name,
            photoFileSize: receiptPhoto?.size,
            notes: receiverNotes,
          }
        );
      } else {
        store.confirmDocumentHandover(
          receiveReceipt.id,
          {
            status:
              status === 'SELISIH DOKUMEN'
                ? 'SELISIH DOKUMEN'
                : 'DITERIMA',
            items: decisionItems,
            photoFileId: fileId,
            photoFileName: receiptPhoto?.name,
            photoFileSize: receiptPhoto?.size,
            notes: receiverNotes,
          }
        );
      }

      const isReturn =
        receiveReceipt.status ===
        'MENUNGGU KONFIRMASI PENGEMBALIAN';

      setReceiveReceipt(null);
      setReceiptPhoto(null);

      alert(
        isReturn
          ? status === 'SELISIH PENGEMBALIAN'
            ? 'Selisih pengembalian berhasil dilaporkan.'
            : 'Penerimaan kembali berhasil dikonfirmasi.'
          : status === 'SELISIH DOKUMEN'
          ? 'Selisih dokumen berhasil dilaporkan.'
          : 'Penerimaan berhasil dikonfirmasi.'
      );
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : 'Gagal memproses penerimaan.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const rejectReceipt = (receipt: DocumentHandover) => {
    const reason = window.prompt('Masukkan alasan penolakan penerimaan:');
    if (!reason) return;
    try {
      store.rejectDocumentHandover(receipt.id, reason);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Gagal menolak Tanda Terima.');
    }
  };

  const cancelReceipt = (receipt: DocumentHandover) => {
    const reason = window.prompt('Masukkan alasan pembatalan Tanda Terima:');
    if (!reason) return;
    try {
      store.cancelDocumentHandover(receipt.id, reason);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Gagal membatalkan Tanda Terima.');
    }
  };

  const viewPhoto = async (receipt: DocumentHandover) => {
    if (!receipt.receiptPhotoFileId) return;
    try {
      await openDocumentHandoverFile(receipt.receiptPhotoFileId);
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : 'Foto tidak ditemukan.'
      );
    }
  };

  const getHistoryEvidence = (
    receipt: DocumentHandover,
    log: AuditLog
  ) => {
    if (log.evidenceFileId) {
      return {
        fileId: log.evidenceFileId,
        fileName: log.evidenceFileName,
      };
    }

    // Backward compatibility evidence sebelum V10.
    if (
      log.action === 'CONFIRM_RECEIVED' &&
      receipt.receiptPhotoFileId
    ) {
      return {
        fileId: receipt.receiptPhotoFileId,
        fileName: receipt.receiptPhotoFileName,
      };
    }

    return null;
  };

  const downloadHistoryEvidence = async (
    receipt: DocumentHandover,
    log: AuditLog
  ) => {
    const evidence =
      getHistoryEvidence(receipt, log);

    if (!evidence) return;

    try {
      await downloadDocumentHandoverFile(
        evidence.fileId,
        evidence.fileName
      );
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : 'Foto bukti tidak dapat didownload.'
      );
    }
  };

  const counts = useMemo(
    () => ({
      ALL: receipts.length,
      TO_RECEIVE: receipts.filter(
        r =>
          (
            r.receiverUserId === currentUser.id &&
            r.status === 'MENUNGGU PENERIMAAN'
          ) ||
          (
            r.senderUserId === currentUser.id &&
            r.status === 'MENUNGGU KONFIRMASI PENGEMBALIAN'
          )
      ).length,
      SENT: receipts.filter(r => r.senderUserId === currentUser.id).length,
      RECEIVED: receipts.filter(
        r => getEffectiveStatus(r) === 'DITERIMA'
      ).length,
      DISCREPANCY: receipts.filter(
        r =>
          r.status === 'SELISIH DOKUMEN' ||
          r.status === 'SELISIH PENGEMBALIAN'
      ).length,
      CLOSED: receipts.filter(r => r.status === 'DITOLAK' || r.status === 'DIBATALKAN').length,
    }),
    [receipts, currentUser.id]
  );

  const filteredReceipts = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return receipts.filter(receipt => {
      const pass =
        filter === 'ALL'
          ? true
          : filter === 'TO_RECEIVE'
          ? (
              receipt.receiverUserId === currentUser.id &&
              receipt.status === 'MENUNGGU PENERIMAAN'
            ) ||
            (
              receipt.senderUserId === currentUser.id &&
              receipt.status === 'MENUNGGU KONFIRMASI PENGEMBALIAN'
            )
          : filter === 'SENT'
          ? receipt.senderUserId === currentUser.id
          : filter === 'RECEIVED'
          ? getEffectiveStatus(receipt) === 'DITERIMA'
          : filter === 'DISCREPANCY'
          ? (
              receipt.status === 'SELISIH DOKUMEN' ||
              receipt.status === 'SELISIH PENGEMBALIAN'
            )
          : receipt.status === 'DITOLAK' || receipt.status === 'DIBATALKAN';

      if (!pass) return false;
      if (!keyword) return true;

      return [
        receipt.id,
        receipt.senderName,
        receipt.receiverName,
        receipt.relatedTransactionId,
        receipt.relatedDescription,
        ...receipt.items.map(item => item.description),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(keyword);
    });
  }, [receipts, currentUser.id, filter, search]);

  const receiptHistory = (receiptId: string) =>
    auditLogs
      .filter(log => log.module === 'TANDA_TERIMA' && log.recordId === receiptId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  if (!canAccess) {
    return (
      <AppLayout>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-10 text-center text-sm font-bold text-rose-700">
          Akses Ditolak. Tanda Terima Dokumen hanya tersedia untuk Marketing, Marketing Administration, dan Team Leader Marketing Support.
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-6 w-6 text-blue-600" />
              <h1 className="text-xl font-black text-gray-900">Tanda Terima Dokumen</h1>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Digital chain of custody untuk penyerahan berkas fisik Marketing ↔ Marketing Administration.
            </p>
          </div>

          {canCreate && (
            <Button type="button" onClick={openCreate} className="gap-2 bg-blue-600 text-white hover:bg-blue-700">
              <Plus className="h-4 w-4" />
              Buat Tanda Terima
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          {[
            ['ALL', 'Semua', counts.ALL],
            ['TO_RECEIVE', 'Menunggu Saya Terima', counts.TO_RECEIVE],
            ['SENT', 'Saya Kirim', counts.SENT],
            ['RECEIVED', 'Diterima', counts.RECEIVED],
            ['DISCREPANCY', 'Selisih', counts.DISCREPANCY],
            ['CLOSED', 'Ditolak / Batal', counts.CLOSED],
          ].map(item => (
            <button
              key={item[0]}
              type="button"
              onClick={() => setFilter(item[0] as ReceiptFilter)}
              className={`rounded-xl border p-3 text-left transition ${
                filter === item[0] ? 'border-blue-300 bg-blue-50 shadow-sm' : 'border-gray-200 bg-white hover:border-blue-200'
              }`}
            >
              <div className="text-[10px] font-bold uppercase text-gray-500">{item[1]}</div>
              <div className="mt-1 text-2xl font-black text-gray-900">{item[2]}</div>
            </button>
          ))}
        </div>

        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-sm font-black">Daftar Tanda Terima</CardTitle>
                <p className="mt-1 text-xs text-gray-500">Klik Detail untuk melihat daftar dokumen, foto bukti, dan riwayat aksi.</p>
              </div>
              <div className="relative w-full lg:w-96">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Cari nomor, pengirim, penerima, dokumen..."
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full min-w-[1080px] text-left text-xs">
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
                      <td colSpan={8} className="p-10 text-center text-xs text-gray-400">
                        Belum ada Tanda Terima pada filter ini.
                      </td>
                    </tr>
                  ) : (
                    filteredReceipts.map(receipt => (
                      <tr key={receipt.id} className="hover:bg-slate-50">
                        <td className="p-3">
                          <div className="font-mono font-black text-blue-700">{receipt.id}</div>
                          <div className="mt-1 text-[10px] text-gray-400">{receipt.handoverType}</div>
                        </td>
                        <td className="p-3 text-gray-700">{formatDateOnly(receipt.handoverDate)}</td>
                        <td className="p-3">
                          <div className="font-semibold text-gray-900">{receipt.senderName}</div>
                          <div className="text-[10px] text-gray-400">
                            {receipt.senderDepartment !== 'None' ? receipt.senderDepartment : receipt.senderUnit}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-gray-900">{receipt.receiverName}</div>
                          <div className="text-[10px] text-gray-400">
                            {receipt.receiverDepartment !== 'None' ? receipt.receiverDepartment : receipt.receiverUnit}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="font-black text-gray-900">{receipt.items.length} item</div>
                          <div className="mt-1 max-w-[220px] truncate text-[10px] text-gray-500">
                            {receipt.items.map(item => item.description).join(', ')}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-gray-900">
                            {getDocumentPosition(receipt).primary}
                          </div>
                          <div className="mt-1 text-[10px] text-gray-400">
                            {getDocumentPosition(receipt).secondary}
                          </div>
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-flex rounded-md border px-2 py-1 text-[10px] font-black ${statusClass(
                              getEffectiveStatus(receipt)
                            )}`}
                          >
                            {getEffectiveStatus(receipt)}
                          </span>

                          <div className="mt-2">
                            <SlaBadge receipt={receipt} />
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap justify-end gap-2">
                            {receipt.receiverUserId === currentUser.id &&
                              (
                                getEffectiveStatus(receipt) === 'DITERIMA' ||
                                getEffectiveStatus(receipt) === 'SELISIH DOKUMEN'
                              ) && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openReturn(receipt)}
                                  className="h-8 border-violet-200 text-[11px] font-bold text-violet-700 hover:bg-violet-50"
                                >
                                  Kembalikan
                                </Button>
                              )}

                            {receipt.senderUserId === currentUser.id &&
                              receipt.status === 'MENUNGGU KONFIRMASI PENGEMBALIAN' && (
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => openReceive(receipt)}
                                  className="h-8 bg-violet-600 text-[11px] text-white hover:bg-violet-700"
                                >
                                  Terima Kembali
                                </Button>
                              )}

                            <Button type="button" variant="outline" size="sm" onClick={() => setDetailReceipt(receipt)} className="h-8 text-[11px]">
                              Detail
                            </Button>

                            {receipt.receiverUserId === currentUser.id && receipt.status === 'MENUNGGU PENERIMAAN' && (
                              <Button type="button" size="sm" onClick={() => openReceive(receipt)} className="h-8 bg-emerald-600 text-[11px] text-white hover:bg-emerald-700">
                                Terima
                              </Button>
                            )}
                            {receipt.receiverUserId === currentUser.id && receipt.status === 'MENUNGGU PENERIMAAN' && (
                              <Button type="button" variant="outline" size="sm" onClick={() => rejectReceipt(receipt)} className="h-8 border-rose-200 text-[11px] text-rose-700 hover:bg-rose-50">
                                Tolak
                              </Button>
                            )}
                            {receipt.senderUserId === currentUser.id && receipt.status === 'MENUNGGU PENERIMAAN' && (
                              <Button type="button" variant="outline" size="sm" onClick={() => cancelReceipt(receipt)} className="h-8 text-[11px]">
                                Batal
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {createOpen && (
          <div className="fixed inset-0 z-[240] flex items-center justify-center bg-black/45 p-4">
            <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl">
              <div className="sticky top-0 z-10 flex items-start justify-between border-b border-gray-200 bg-white px-6 py-5">
                <div>
                  <div className="flex items-center gap-2">
                    <Send className="h-5 w-5 text-blue-600" />
                    <h2 className="text-lg font-black text-gray-900">
                      {handoverType === 'PENGEMBALIAN DOKUMEN'
                        ? 'Kembalikan Dokumen'
                        : 'Buat Tanda Terima Dokumen'}
                    </h2>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {handoverType === 'PENGEMBALIAN DOKUMEN'
                      ? 'Pengembalian dicatat pada registry sebelumnya dan tidak membuat nomor TRM baru.'
                      : 'Nomor TRM dibuat otomatis saat Submit.'}
                  </p>
                </div>
                <button type="button" onClick={() => setCreateOpen(false)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-6 p-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-gray-700">
                      {handoverType === 'PENGEMBALIAN DOKUMEN'
                        ? 'Tanggal Pengembalian *'
                        : 'Tanggal Penyerahan *'}
                    </label>
                    <Input type="date" value={handoverDate} onChange={event => setHandoverDate(event.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-gray-700">Pengirim</label>
                    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs">
                      <div className="font-bold text-gray-900">{currentUser.name}</div>
                      <div className="text-[10px] text-gray-500">{currentUser.position}</div>
                    </div>
                  </div>
                </div>

                {handoverType === 'PENGEMBALIAN DOKUMEN' && (
                  <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-violet-600">
                      Registry Tanda Terima
                    </div>
                    <div className="mt-1 font-mono text-sm font-black text-violet-900">
                      {relatedReceiptId}
                    </div>
                    <div className="mt-1 text-xs text-violet-700">
                      Pengembalian akan dicatat pada riwayat registry ini dan tidak membuat nomor TRM baru.
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-gray-700">Penerima *</label>
                    <Select
                      value={receiverId}
                      onValueChange={setReceiverId}
                      disabled={handoverType === 'PENGEMBALIAN DOKUMEN'}
                    >
                      <SelectTrigger><SelectValue placeholder="Pilih penerima..." /></SelectTrigger>
                      <SelectContent position="popper" className="z-[300] max-h-72">
                        {eligibleReceivers.map(user => (
                          <SelectItem key={user.id} value={user.id}>{user.name} · {user.position}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="mt-1 text-[10px] text-gray-400">Hanya fungsi lawan: Marketing ↔ Marketing Administration.</p>
                  </div>

                  {handoverType !== 'PENGEMBALIAN DOKUMEN' && (
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-gray-700">Terkait Proses</label>
                      <Select
                        value={relatedModule}
                        onValueChange={value => {
                          setRelatedModule(value as DocumentHandoverRelatedModule);
                          setRelatedTransactionId('');
                        }}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent position="popper" className="z-[300]">
                          <SelectItem value="NONE">Tidak terkait transaksi</SelectItem>
                          <SelectItem value="PIPELINE">Pipeline</SelectItem>
                          <SelectItem value="BOOKING">Booking Case</SelectItem>
                          <SelectItem value="REIMBURSEMENT">Reimbursement</SelectItem>
                          <SelectItem value="LAINNYA">Lainnya</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {handoverType !== 'PENGEMBALIAN DOKUMEN' &&
                  ['PIPELINE', 'BOOKING', 'REIMBURSEMENT'].includes(relatedModule) && (
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-gray-700">Related Transaction ID</label>
                    <Select value={relatedTransactionId} onValueChange={setRelatedTransactionId}>
                      <SelectTrigger><SelectValue placeholder="Pilih transaksi terkait..." /></SelectTrigger>
                      <SelectContent position="popper" className="z-[300] max-h-72">
                        {relationOptions.map(option => (
                          <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {handoverType !== 'PENGEMBALIAN DOKUMEN' &&
                  relatedModule === 'LAINNYA' && (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-gray-700">Related ID</label>
                      <Input value={relatedTransactionId} onChange={event => setRelatedTransactionId(event.target.value)} placeholder="Nomor referensi bila ada" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-gray-700">Keterangan</label>
                      <Input value={relatedDescription} onChange={event => setRelatedDescription(event.target.value)} placeholder="Contoh: Tagihan RS ABC Mei 2026" />
                    </div>
                  </div>
                )}

                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-black text-gray-900">Daftar Dokumen Fisik</div>
                      <div className="text-[11px] text-gray-500">Satu Tanda Terima dapat memuat lebih dari satu dokumen.</div>
                    </div>
                    {handoverType !== 'PENGEMBALIAN DOKUMEN' && (
                      <Button type="button" variant="outline" size="sm" onClick={() => setDraftItems(current => [...current, emptyItem()])} className="gap-2">
                        <Plus className="h-4 w-4" /> Tambah Dokumen
                      </Button>
                    )}
                  </div>

                  <div className="space-y-3">
                    {draftItems.map((item, index) => (
                      <div key={index} className="rounded-xl border border-gray-200 bg-slate-50/50 p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <div className="text-xs font-black text-gray-900">Dokumen {index + 1}</div>
                          {draftItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setDraftItems(current => current.filter((_, itemIndex) => itemIndex !== index))}
                              className="text-[11px] font-bold text-rose-600"
                            >
                              Hapus
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                          <div className="md:col-span-3">
                            <label className="mb-1 block text-[10px] font-bold text-gray-600">Jenis Dokumen *</label>
                            <Select
                              value={item.documentType}
                              onValueChange={value =>
                                setDraftItems(current =>
                                  current.map((currentItem, itemIndex) =>
                                    itemIndex === index ? { ...currentItem, documentType: value as DocumentHandoverItem['documentType'] } : currentItem
                                  )
                                )
                              }
                            >
                              <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                              <SelectContent position="popper" className="z-[300]">
                                {DOCUMENT_TYPES.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="md:col-span-4">
                            <label className="mb-1 block text-[10px] font-bold text-gray-600">Nama / Deskripsi *</label>
                            <Input
                              value={item.description}
                              onChange={event =>
                                setDraftItems(current =>
                                  current.map((currentItem, itemIndex) =>
                                    itemIndex === index ? { ...currentItem, description: event.target.value } : currentItem
                                  )
                                )
                              }
                              placeholder="Contoh: Invoice RS ABC Mei 2026"
                              className="bg-white"
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label className="mb-1 block text-[10px] font-bold text-gray-600">Bentuk *</label>
                            <Select
                              value={item.physicalForm}
                              onValueChange={value =>
                                setDraftItems(current =>
                                  current.map((currentItem, itemIndex) =>
                                    itemIndex === index ? { ...currentItem, physicalForm: value as DocumentHandoverItem['physicalForm'] } : currentItem
                                  )
                                )
                              }
                            >
                              <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                              <SelectContent position="popper" className="z-[300]">
                                {PHYSICAL_FORMS.map(form => <SelectItem key={form} value={form}>{form}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="md:col-span-1">
                            <label className="mb-1 block text-[10px] font-bold text-gray-600">Qty *</label>
                            <Input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={event =>
                                setDraftItems(current =>
                                  current.map((currentItem, itemIndex) =>
                                    itemIndex === index ? { ...currentItem, quantity: Math.max(1, Number(event.target.value) || 1) } : currentItem
                                  )
                                )
                              }
                              className="bg-white"
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label className="mb-1 block text-[10px] font-bold text-gray-600">Catatan</label>
                            <Input
                              value={item.notes}
                              onChange={event =>
                                setDraftItems(current =>
                                  current.map((currentItem, itemIndex) =>
                                    itemIndex === index ? { ...currentItem, notes: event.target.value } : currentItem
                                  )
                                )
                              }
                              placeholder="Opsional"
                              className="bg-white"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <div className="flex items-center gap-2 text-xs font-black text-blue-900">
                    <Camera className="h-4 w-4" />
                    {handoverType === 'PENGEMBALIAN DOKUMEN'
                      ? 'Foto Bukti Pengembalian *'
                      : 'Foto Bukti Penyerahan *'}
                  </div>
                  <p className="mt-1 text-[10px] text-blue-700">
                    Wajib diupload oleh pihak yang menyerahkan dokumen.
                    Hindari menampilkan isi dokumen yang bersifat rahasia.
                  </p>
                  <Input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={event =>
                      setHandoverPhoto(
                        event.target.files?.[0] || null
                      )
                    }
                    className="mt-3 bg-white"
                  />
                  {handoverPhoto && (
                    <div className="mt-2 text-[10px] font-semibold text-blue-800">
                      {handoverPhoto.name} · {(handoverPhoto.size / 1024).toFixed(1)} KB
                    </div>
                  )}
                </div>
              </div>

              <div className="sticky bottom-0 flex justify-end gap-2 border-t border-gray-200 bg-white px-6 py-4">
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Batal</Button>
                <Button
                  type="button"
                  disabled={submitting}
                  onClick={submitCreate}
                  className="gap-2 bg-blue-600 text-white hover:bg-blue-700"
                >
                  <Send className="h-4 w-4" />
                  {handoverType === 'PENGEMBALIAN DOKUMEN'
                    ? 'Catat Pengembalian'
                    : 'Kirim Tanda Terima'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {receiveReceipt && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/45 p-4">
            <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl">
              <div className="sticky top-0 z-10 flex items-start justify-between border-b border-gray-200 bg-white px-6 py-5">
                <div>
                  <h2 className="text-lg font-black text-gray-900">
                    {receiveReceipt.status === 'MENUNGGU KONFIRMASI PENGEMBALIAN'
                      ? 'Konfirmasi Penerimaan Kembali'
                      : 'Konfirmasi Penerimaan Dokumen'}
                  </h2>
                  <p className="mt-1 text-xs text-gray-500">
                    {receiveReceipt.id} · dari{' '}
                    {receiveReceipt.status === 'MENUNGGU KONFIRMASI PENGEMBALIAN'
                      ? receiveReceipt.returnSubmittedByName || receiveReceipt.receiverName
                      : receiveReceipt.senderName}
                  </p>
                </div>
                <button type="button" onClick={() => setReceiveReceipt(null)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-5 p-6">
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-800">
                  {receiveReceipt.status === 'MENUNGGU KONFIRMASI PENGEMBALIAN'
                    ? 'Cocokkan dokumen yang dikembalikan satu per satu. Jika jumlah berbeda, ubah Qty Diterima lalu laporkan selisih pengembalian.'
                    : 'Cocokkan dokumen fisik satu per satu. Jika jumlah berbeda, ubah Qty Diterima lalu laporkan selisih.'}
                </div>

                <div className="space-y-3">
                  {(
                    receiveReceipt.status === 'MENUNGGU KONFIRMASI PENGEMBALIAN'
                      ? receiveReceipt.returnItems || []
                      : receiveReceipt.items
                  ).map(item => {
                    const decision = decisionItems.find(current => current.itemId === item.id);
                    return (
                      <div key={item.id} className="rounded-xl border border-gray-200 p-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                          <div className="md:col-span-6">
                            <div className="text-xs font-black text-gray-900">{item.description}</div>
                            <div className="mt-1 text-[10px] text-gray-500">
                              {'documentType' in item
                                ? `${item.documentType} · ${item.physicalForm} · `
                                : 'Dokumen Pengembalian · '}
                              Qty diserahkan {item.quantity}
                            </div>
                          </div>
                          <div className="md:col-span-2">
                            <label className="mb-1 block text-[10px] font-bold text-gray-600">Qty Diterima *</label>
                            <Input
                              type="number"
                              min={0}
                              max={item.quantity}
                              value={decision?.receivedQuantity ?? 0}
                              onChange={event =>
                                setDecisionItems(current =>
                                  current.map(currentItem =>
                                    currentItem.itemId === item.id
                                      ? {
                                          ...currentItem,
                                          receivedQuantity: Math.max(0, Math.min(item.quantity, Number(event.target.value) || 0)),
                                        }
                                      : currentItem
                                  )
                                )
                              }
                            />
                          </div>
                          <div className="md:col-span-4">
                            <label className="mb-1 block text-[10px] font-bold text-gray-600">Catatan Penerima</label>
                            <Input
                              value={decision?.receiverNotes ?? ''}
                              onChange={event =>
                                setDecisionItems(current =>
                                  current.map(currentItem =>
                                    currentItem.itemId === item.id ? { ...currentItem, receiverNotes: event.target.value } : currentItem
                                  )
                                )
                              }
                              placeholder="Contoh: 1 lembar belum diterima"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-center gap-2 text-xs font-black text-emerald-900">
                    <Camera className="h-4 w-4" />
                    {receiveReceipt.status === 'MENUNGGU KONFIRMASI PENGEMBALIAN'
                      ? 'Foto Bukti Penerimaan Kembali (Opsional)'
                      : 'Foto Bukti Penerimaan (Opsional)'}
                  </div>
                  <p className="mt-1 text-[10px] text-emerald-800">
                    Foto disarankan memperlihatkan proses penerimaan berkas tanpa menampilkan isi dokumen rahasia.
                  </p>
                  <Input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={event => setReceiptPhoto(event.target.files?.[0] || null)}
                    className="mt-3 bg-white"
                  />
                  {receiptPhoto && (
                    <div className="mt-2 text-[10px] font-semibold text-emerald-800">
                      {receiptPhoto.name} · {(receiptPhoto.size / 1024).toFixed(1)} KB
                    </div>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-gray-700">
                    {receiveReceipt.status === 'MENUNGGU KONFIRMASI PENGEMBALIAN'
                      ? 'Catatan Penerimaan Kembali'
                      : 'Catatan Penerimaan'}
                  </label>
                  <Textarea value={receiverNotes} onChange={event => setReceiverNotes(event.target.value)} placeholder="Opsional" />
                </div>
              </div>

              <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-gray-200 bg-white px-6 py-4">
                <Button type="button" variant="outline" onClick={() => setReceiveReceipt(null)}>Batal</Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={submitting}
                  onClick={() =>
                    submitDecision(
                      receiveReceipt.status === 'MENUNGGU KONFIRMASI PENGEMBALIAN'
                        ? 'SELISIH PENGEMBALIAN'
                        : 'SELISIH DOKUMEN'
                    )
                  }
                  className="border-amber-300 text-amber-800 hover:bg-amber-50"
                >
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  {receiveReceipt.status === 'MENUNGGU KONFIRMASI PENGEMBALIAN'
                    ? 'Laporkan Selisih Pengembalian'
                    : 'Laporkan Selisih'}
                </Button>
                <Button
                  type="button"
                  disabled={submitting}
                  onClick={() =>
                    submitDecision(
                      receiveReceipt.status === 'MENUNGGU KONFIRMASI PENGEMBALIAN'
                        ? 'DIKEMBALIKAN'
                        : 'DITERIMA'
                    )
                  }
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {receiveReceipt.status === 'MENUNGGU KONFIRMASI PENGEMBALIAN'
                    ? 'Konfirmasi Diterima Kembali'
                    : 'Konfirmasi Diterima'}
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
                    <h2 className="text-lg font-black text-gray-900">{detailReceipt.id}</h2>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span
                      className={`rounded-md border px-2 py-1 text-[10px] font-black ${statusClass(
                        getEffectiveStatus(detailReceipt)
                      )}`}
                    >
                      {getEffectiveStatus(detailReceipt)}
                    </span>
                    <SlaBadge receipt={detailReceipt} />
                  </div>
                </div>
                <button type="button" onClick={() => setDetailReceipt(null)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-6 p-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  {[
                    ['Tanggal', formatDateOnly(detailReceipt.handoverDate)],
                    ['Pengirim', detailReceipt.senderName],
                    ['Penerima', detailReceipt.receiverName],
                    ['Posisi Dokumen', getDocumentPosition(detailReceipt).primary],
                  ].map(item => (
                    <div key={item[0]} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                      <div className="text-[10px] font-bold uppercase text-gray-400">{item[0]}</div>
                      <div className="mt-1 text-xs font-black text-gray-900">{item[1]}</div>
                    </div>
                  ))}
                </div>

                {detailReceipt.relatedReceiptId && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    Pengembalian terkait receipt sebelumnya: <strong>{detailReceipt.relatedReceiptId}</strong>
                  </div>
                )}

                <div>
                  <div className="mb-2 text-sm font-black text-gray-900">Daftar Dokumen</div>
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
                        {detailReceipt.items.map(item => (
                          <tr key={item.id}>
                            <td className="p-3">
                              <div className="font-semibold text-gray-900">{item.description}</div>
                              <div className="text-[10px] text-gray-400">{item.documentType}</div>
                            </td>
                            <td className="p-3">{item.physicalForm}</td>
                            <td className="p-3 font-bold">{item.quantity}</td>
                            <td className="p-3 font-bold">{item.receivedQuantity ?? '-'}</td>
                            <td className="p-3 text-gray-600">{item.receiverNotes || item.notes || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {detailReceipt.receiptPhotoFileId && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-xs font-black text-emerald-900">Foto Bukti Penerimaan</div>
                        <div className="text-[10px] text-emerald-700">{detailReceipt.receiptPhotoFileName}</div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => viewPhoto(detailReceipt)}
                        className="gap-2 border-emerald-300 bg-white text-emerald-800"
                      >
                        <Download className="h-4 w-4" /> Lihat Foto Bukti
                      </Button>
                    </div>
                  </div>
                )}

                <div>
                  <div className="mb-3 text-sm font-black text-gray-900">Riwayat Aksi</div>
                  <div className="space-y-2">
                    {receiptHistory(detailReceipt.id).length === 0 ? (
                      <div className="text-xs text-gray-400">Belum ada riwayat.</div>
                    ) : (
                      receiptHistory(detailReceipt.id).map(log => (
                        <div key={log.id} className="rounded-xl border border-gray-200 bg-slate-50 p-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <div className="text-xs font-black text-gray-900">
                                {log.action.replace(/_/g, ' ')}
                              </div>
                              <div className="mt-1 text-[10px] text-gray-400">
                                {formatDateTime(log.timestamp)}
                              </div>
                            </div>

                            {getHistoryEvidence(detailReceipt, log) && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  downloadHistoryEvidence(
                                    detailReceipt,
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
                          <div className="mt-1 text-[11px] text-gray-600">{log.userName} · {log.userRole}</div>
                          {log.reason && (
                            <div className="mt-1 text-[10px] text-gray-500">
                              {log.reason}
                            </div>
                          )}

                          {log.fileReference && (
                            <div className="mt-1 text-[10px] text-gray-500">
                              {log.action === 'RETURN_HANDOVER'
                                ? `Dokumen dikembalikan: ${log.fileReference}`
                                : log.fileReference}
                            </div>
                          )}
                        </div>
                      ))
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

export default TandaTerimaPage;
