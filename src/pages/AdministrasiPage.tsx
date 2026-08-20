import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { store, BASELINE_USERS } from '@/services/store';
import { User, ProductMaster, AuditLog } from '@/types';
import { ExcelExportButton } from '@/components/common/ExcelExportButton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Settings, Users, Package, ShieldAlert, RotateCcw, Database } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export const AdministrasiPage: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User>(store.getCurrentUser());
  const [users, setUsers] = useState<User[]>([]);
  const [products, setProducts] = useState<ProductMaster[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    const refresh = () => {
      setCurrentUser(store.getCurrentUser());
      setUsers(store.getUsers());
      setProducts(store.getProducts());
      setAuditLogs(store.getAuditLogs());
    };
    refresh();
    return store.subscribe(refresh);
  }, []);

  const isSysAdmin = currentUser.role === 'SYSTEM_ADMIN';

  if (!isSysAdmin) {
    return (
      <AppLayout>
        <div className="p-12 text-center text-rose-700 font-bold text-sm bg-rose-50 rounded-xl border border-rose-200">
          Akses Ditolak. Menu Administrasi Sistem hanya diperuntukkan bagi SYSTEM_ADMIN.
        </div>
      </AppLayout>
    );
  }

  const handleGenerateDummy = () => {
    if (
      !confirm(
        'Apakah Anda yakin ingin memunculkan sampel data dummy untuk UAT testing?'
      )
    ) {
      return;
    }

    try {
      store.generateDummyData();

      const bookingCount =
        store.getBookings().length;
      const pipelineCount =
        store.getPipelines().length;
      const productionCount =
        store.getProductions().length;
      const activityCount =
        store.getActivities().length;

      alert(
        `Data dummy UAT berhasil di-generate!\n\nBooking: ${bookingCount}\nPipeline: ${pipelineCount}\nProduksi: ${productionCount}\nAktivitas: ${activityCount}`
      );
    } catch (error) {
      console.error(
        'Generate UAT Dummy Data gagal:',
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : 'Terjadi error yang tidak diketahui.';

      alert(
        `Generate Data Dummy gagal.\n\n${message}`
      );
    }
  };

  const handleResetDummy =
    async () => {
      if (
        !confirm(
          'FACTORY RESET PROTOTYPE: Seluruh data UAT dan seluruh data yang pernah diinput/upload oleh user akan dihapus, termasuk Target RKAP, Booking, Pipeline, Produksi, Realisasi Official, Aktivitas, komentar, Reimbursement, Historical, Dokumen Pendukung beserta file binary, Notification, publish history, dan Audit Trail. User Master, Product Master, dan baseline Broker Master OJK dipertahankan. Lanjutkan?'
        )
      ) {
        return;
      }

      try {
        await store.resetDataDummy();

        alert(
          'Prototype berhasil di-reset ke kondisi 0. Seluruh data user, upload, aktivitas, dan Audit Trail telah dihapus. User Master, Product Master, dan baseline Broker Master OJK tetap tersedia.'
        );
      } catch (
        error
      ) {
        console.error(
          'Prototype reset gagal:',
          error
        );

        alert(
          error instanceof
            Error
            ? error.message
            : 'Prototype reset gagal. Silakan coba kembali.'
        );
      }
    };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Administrasi Sistem & Modul Pengawasan</h1>
            <p className="text-xs text-gray-500 mt-1">Manajemen User Master, Master Produk, Audit Trail, dan Tools UAT Data Dummy</p>
          </div>
          <ExcelExportButton
            data={auditLogs.map(l => ({ Timestamp: l.timestamp, User: l.userName, Role: l.userRole, Module: l.module, Action: l.action, Record: l.recordId }))}
            filename="System_Audit_Log"
          />
        </div>

        {/* UAT DATA DUMMY CONTROL CARDS */}
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-amber-600" />
              <CardTitle className="text-sm font-bold text-amber-900">UAT Data Testing & Reset Control</CardTitle>
            </div>
            <CardDescription className="text-xs text-amber-800">
              Gunakan tombol di bawah untuk mengisi sampel transaksi UAT atau mengosongkan kembali seluruh transaksi ke keadaan 0 awal.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3 pt-2">
            <Button onClick={handleGenerateDummy} className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold gap-2">
              <Database className="w-4 h-4" />
              <span>Generate Sample UAT Dummy Data</span>
            </Button>

            <Button onClick={handleResetDummy} variant="outline" className="border-rose-300 text-rose-800 hover:bg-rose-50 text-xs font-bold gap-2">
              <RotateCcw className="w-4 h-4 text-rose-600" />
              <span>Reset Data Dummy (Kembali ke 0 Transaksi)</span>
            </Button>
          </CardContent>
        </Card>

        <Tabs defaultValue="users" className="w-full">
          <TabsList className="bg-white border border-gray-200 p-1 rounded-xl shadow-sm grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="users" className="text-xs font-bold">Master Users</TabsTrigger>
            <TabsTrigger value="products" className="text-xs font-bold">Master Produk</TabsTrigger>
            <TabsTrigger value="audit" className="text-xs font-bold">Audit Log</TabsTrigger>
          </TabsList>

          {/* TAB 1: USERS */}
          <TabsContent value="users" className="space-y-4 mt-4">
            <Card className="border-gray-200">
              <CardHeader>
                <CardTitle className="text-sm font-bold">Baseline User Master (27 Pegawai + System Admin)</CardTitle>
                <CardDescription className="text-xs">Struktur hierarki PertaLife Insurance terdaftar di database</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200 uppercase text-[10px] text-gray-600">
                      <tr>
                        <th className="p-3">User ID</th>
                        <th className="p-3">Nama Pegawai</th>
                        <th className="p-3">Email Demo</th>
                        <th className="p-3">Jabatan</th>
                        <th className="p-3">Unit / Dept</th>
                        <th className="p-3">Role</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {users.map(u => (
                        <tr key={u.id} className="hover:bg-gray-50">
                          <td className="p-3 font-mono font-bold text-blue-700">{u.id}</td>
                          <td className="p-3 font-semibold text-gray-900">{u.name}</td>
                          <td className="p-3 text-gray-600">{u.email}</td>
                          <td className="p-3 text-gray-700">{u.position}</td>
                          <td className="p-3 text-gray-600">{u.department !== 'None' ? u.department : u.unit}</td>
                          <td className="p-3"><Badge variant="outline" className="text-[10px]">{u.role}</Badge></td>
                          <td className="p-3">
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px]">
                              {u.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: PRODUCTS */}
          <TabsContent value="products" className="space-y-4 mt-4">
            <Card className="border-gray-200">
              <CardHeader>
                <CardTitle className="text-sm font-bold">Master Produk Asuransi Jiwa & Kesehatan</CardTitle>
                <CardDescription className="text-xs">Kategori Individu dan Kumpulan terdaftar di database</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200 uppercase text-[10px] text-gray-600">
                      <tr>
                        <th className="p-3">Kode Produk</th>
                        <th className="p-3">Nama Produk</th>
                        <th className="p-3">Jenis Asuransi</th>
                        <th className="p-3">Kategori Nasabah</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {products.map(p => (
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="p-3 font-mono font-bold text-blue-700">{p.productCode}</td>
                          <td className="p-3 font-semibold text-gray-900">{p.productName}</td>
                          <td className="p-3 text-gray-700">{p.insuranceType}</td>
                          <td className="p-3 text-gray-600">{p.customerCategory}</td>
                          <td className="p-3">
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px]">
                              {p.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: AUDIT LOG */}

          <TabsContent value="audit" className="space-y-4 mt-4">
            <Card className="border-gray-200">
              <CardHeader>
                <CardTitle className="text-sm font-bold">System Audit Trail</CardTitle>
                <CardDescription className="text-xs">Rekam jejak seluruh aktivitas perubahan data bisnis di dalam sistem</CardDescription>
              </CardHeader>
              <CardContent>
                {auditLogs.length === 0 ? (
                  <div className="p-12 text-center text-xs text-gray-400">Belum ada aktivitas audit tercatat.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 border-b border-gray-200 uppercase text-[10px] text-gray-600">
                        <tr>
                          <th className="p-3">Waktu</th>
                          <th className="p-3">Pegawai</th>
                          <th className="p-3">Modul</th>
                          <th className="p-3">Aksi</th>
                          <th className="p-3">Record ID</th>
                          <th className="p-3">Catatan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {auditLogs.map(l => (
                          <tr key={l.id} className="hover:bg-gray-50">
                            <td className="p-3 font-mono text-[11px] text-gray-500">{new Date(l.timestamp).toLocaleString('id-ID')}</td>
                            <td className="p-3 font-semibold text-gray-900">{l.userName}</td>
                            <td className="p-3 font-bold text-blue-700">{l.module}</td>
                            <td className="p-3 text-gray-800">{l.action}</td>
                            <td className="p-3 font-mono text-gray-600">{l.recordId}</td>
                            <td className="p-3 text-gray-600">{l.fileReference || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>


      </div>
    </AppLayout>
  );
};

export default AdministrasiPage;