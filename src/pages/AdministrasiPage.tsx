import React, {
  useEffect,
  useMemo,
  useState,
} from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { store } from "@/services/store";
import {
  AdminAccount,
  BulkActivationResult,
  activateAccount,
  activateAllAccounts,
  getAdminAccounts,
  globalResetAllBusinessData,
  resetAccountPassword,
  sendAdminTestNotification,
} from "@/services/adminService";
import { syncGlobalResetState } from "@/lib/globalResetSync";
import {
  ProductMaster,
  AuditLog,
} from "@/types";
import { ExcelExportButton } from "@/components/common/ExcelExportButton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Badge,
} from "@/components/ui/badge";
import {
  BellRing,
  Copy,
  Database,
  KeyRound,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";

const ACCOUNT_STATUS_LABELS:
  Record<
    AdminAccount["account_status"],
    string
  > = {
    NOT_INVITED:
      "Belum Diaktifkan",
    AUTH_LINK_CHECK:
      "Cek Link Auth",
    INVITED_NOT_CONFIRMED:
      "Auth Belum Selesai",
    ACTIVE:
      "Aktif",
  };

const makePassword = () => {
  const upper =
    "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower =
    "abcdefghijkmnopqrstuvwxyz";
  const number =
    "23456789";
  const symbol =
    "!@#$%*-_";
  const all =
    upper +
    lower +
    number +
    symbol;

  const randomChar = (
    chars: string
  ) => {
    const bytes =
      new Uint32Array(1);

    crypto.getRandomValues(
      bytes
    );

    return chars[
      bytes[0] %
        chars.length
    ];
  };

  const required = [
    randomChar(upper),
    randomChar(lower),
    randomChar(number),
    randomChar(symbol),
  ];

  while (
    required.length < 16
  ) {
    required.push(
      randomChar(all)
    );
  }

  for (
    let i =
      required.length - 1;
    i > 0;
    i -= 1
  ) {
    const bytes =
      new Uint32Array(1);

    crypto.getRandomValues(
      bytes
    );

    const j =
      bytes[0] % (i + 1);

    [
      required[i],
      required[j],
    ] = [
      required[j],
      required[i],
    ];
  }

  return required.join("");
};

const copyText =
  async (
    value: string
  ) => {
    if (
      !navigator.clipboard
    ) {
      throw new Error(
        "Clipboard tidak tersedia."
      );
    }

    await navigator.clipboard.writeText(
      value
    );
  };

export const AdministrasiPage:
  React.FC = () => {
    const { profile } =
      useAuth();

    const [
      accounts,
      setAccounts,
    ] = useState<
      AdminAccount[]
    >([]);

    const [
      products,
      setProducts,
    ] = useState<
      ProductMaster[]
    >([]);

    const [
      auditLogs,
      setAuditLogs,
    ] = useState<
      AuditLog[]
    >([]);

    const [
      loading,
      setLoading,
    ] = useState(true);

    const [
      resetBusy,
      setResetBusy,
    ] = useState(false);

    const [
      passwordTarget,
      setPasswordTarget,
    ] = useState<
      AdminAccount | null
    >(null);

    const [
      passwordValue,
      setPasswordValue,
    ] = useState("");

    const [
      passwordConfirm,
      setPasswordConfirm,
    ] = useState("");

    const [
      passwordBusy,
      setPasswordBusy,
    ] = useState(false);

    const [
      activationTarget,
      setActivationTarget,
    ] = useState<
      AdminAccount | null
    >(null);

    const [
      activationPassword,
      setActivationPassword,
    ] = useState("");

    const [
      activationBusy,
      setActivationBusy,
    ] = useState(false);

    const [
      bulkActivationBusy,
      setBulkActivationBusy,
    ] = useState(false);

    const [
      bulkResults,
      setBulkResults,
    ] = useState<
      BulkActivationResult[]
    >([]);

    const [
      testBusyProfileId,
      setTestBusyProfileId,
    ] = useState<
      string | null
    >(null);

    const isSysAdmin =
      Boolean(
        profile &&
          (
            profile.role_level
              .trim()
              .toUpperCase() ===
              "SYSTEM_ADMIN" ||
            profile.unit
              .trim()
              .toLowerCase() ===
              "administrasi sistem"
          )
      );

    const refresh =
      async () => {
        setLoading(true);

        try {
          const accountRows =
            await getAdminAccounts();

          setAccounts(
            accountRows
          );

          setProducts(
            store.getProducts()
          );

          setAuditLogs(
            store.getAuditLogs()
          );
        } catch (error) {
          console.error(error);

          alert(
            error instanceof Error
              ? error.message
              : "Gagal membaca data admin."
          );
        } finally {
          setLoading(false);
        }
      };

    useEffect(() => {
      if (
        !profile ||
        !isSysAdmin
      ) {
        return;
      }

      refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      profile?.id,
      isSysAdmin,
    ]);

    const activeCount =
      useMemo(
        () =>
          accounts.filter(
            (account) =>
              account.account_status ===
              "ACTIVE"
          ).length,
        [accounts]
      );

    const pendingActivationCount =
      useMemo(
        () =>
          accounts.filter(
            (account) =>
              !account.auth_user_id &&
              account.role_level
                .trim()
                .toUpperCase() !==
                "SYSTEM_ADMIN"
          ).length,
        [accounts]
      );

    const bulkSuccessful =
      useMemo(
        () =>
          bulkResults.filter(
            (item) =>
              item.status ===
                "CREATED" ||
              item.status ===
                "REPAIRED"
          ),
        [bulkResults]
      );

    if (!isSysAdmin) {
      return (
        <AppLayout>
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-12 text-center text-sm font-bold text-rose-700">
            Akses Ditolak.
            Menu Administrasi
            Sistem hanya untuk
            SYSTEM_ADMIN.
          </div>
        </AppLayout>
      );
    }

    const handleGlobalReset =
      async () => {
        const confirmation =
          window.prompt(
            "GLOBAL RESET akan menghapus seluruh data bisnis/UAT untuk semua akun. Akun Supabase Auth dan struktur profiles tetap tersedia.\n\nKetik RESET GLOBAL untuk melanjutkan:"
          );

        if (
          confirmation !==
          "RESET GLOBAL"
        ) {
          return;
        }

        setResetBusy(true);

        try {
          const result =
            await globalResetAllBusinessData();

          let browserSyncWarning =
            "";

          try {
            await syncGlobalResetState();
          } catch (
            syncError
          ) {
            console.error(
              "Global reset server berhasil, tetapi browser sync gagal:",
              syncError
            );

            const syncMessage =
              syncError instanceof Error
                ? syncError.message
                : syncError &&
                    typeof syncError ===
                      "object" &&
                    "message" in syncError
                  ? String(
                      (
                        syncError as {
                          message?: unknown;
                        }
                      ).message ||
                        "Unknown sync error"
                    )
                  : String(
                      syncError ||
                        "Unknown sync error"
                    );

            browserSyncWarning =
              `\n\nCatatan: reset server berhasil, tetapi sinkronisasi browser mengalami kendala: ${syncMessage}. Halaman akan dimuat ulang untuk mengambil state terbaru.`;
          }

          alert(
            `Global reset berhasil.\n\nFile attachment terhapus: ${
              result?.deleted_storage_files ??
              0
            }\n\nSeluruh akun tetap tersedia. Browser user lain akan ikut mengosongkan data UAT maksimal 60 detik / saat refresh berikutnya.${browserSyncWarning}`
          );

          window.location.reload();
        } catch (error) {
          console.error(error);

          alert(
            error instanceof Error
              ? error.message
              : "Global reset gagal."
          );
        } finally {
          setResetBusy(false);
        }
      };

    const openActivation = (
      account: AdminAccount
    ) => {
      if (
        account.auth_user_id
      ) {
        alert(
          "Akun ini sudah memiliki Supabase Auth user."
        );
        return;
      }

      setActivationTarget(
        account
      );

      setActivationPassword(
        makePassword()
      );
    };

    const closeActivation =
      () => {
        if (
          activationBusy
        ) {
          return;
        }

        setActivationTarget(
          null
        );

        setActivationPassword(
          ""
        );
      };

    const handleActivation =
      async () => {
        if (
          !activationTarget
        ) {
          return;
        }

        if (
          activationPassword.length <
          12
        ) {
          alert(
            "Password minimal 12 karakter."
          );
          return;
        }

        if (
          !window.confirm(
            `Aktifkan akun ${activationTarget.full_name} (${activationTarget.email}) tanpa email invite?`
          )
        ) {
          return;
        }

        setActivationBusy(true);

        try {
          await activateAccount(
            activationTarget.profile_id,
            activationPassword
          );

          try {
            await copyText(
              activationPassword
            );
          } catch {
            // Password still remains visible in the dialog until it closes.
          }

          alert(
            `Akun ${activationTarget.full_name} berhasil diaktifkan.\n\nTemporary password sudah dicopy jika browser mengizinkan. Tidak ada email invite yang dikirim.`
          );

          closeActivation();
          await refresh();
        } catch (error) {
          console.error(error);

          alert(
            error instanceof Error
              ? error.message
              : "Aktivasi akun gagal."
          );
        } finally {
          setActivationBusy(false);
        }
      };

    const handleBulkActivation =
      async () => {
        if (
          pendingActivationCount ===
          0
        ) {
          alert(
            "Tidak ada akun yang perlu diaktifkan."
          );
          return;
        }

        const confirmation =
          window.prompt(
            `Akan membuat Supabase Auth untuk ${pendingActivationCount} profile aktif tanpa email invite.\n\nSetiap user mendapatkan temporary password unik. Password hanya ditampilkan sekali setelah proses selesai.\n\nKetik AKTIFKAN SEMUA untuk melanjutkan:`
          );

        if (
          confirmation !==
          "AKTIFKAN SEMUA"
        ) {
          return;
        }

        setBulkActivationBusy(
          true
        );

        try {
          const result =
            await activateAllAccounts();

          setBulkResults(
            result.results || []
          );

          await refresh();
        } catch (error) {
          console.error(error);

          alert(
            error instanceof Error
              ? error.message
              : "Bulk activation gagal."
          );
        } finally {
          setBulkActivationBusy(
            false
          );
        }
      };

    const openPasswordReset = (
      account: AdminAccount
    ) => {
      if (
        !account.auth_user_id
      ) {
        alert(
          "Akun belum memiliki Auth user."
        );
        return;
      }

      const generated =
        makePassword();

      setPasswordTarget(
        account
      );

      setPasswordValue(
        generated
      );

      setPasswordConfirm(
        generated
      );
    };

    const closePasswordReset =
      () => {
        if (
          passwordBusy
        ) {
          return;
        }

        setPasswordTarget(
          null
        );

        setPasswordValue("");
        setPasswordConfirm("");
      };

    const handlePasswordReset =
      async () => {
        if (
          !passwordTarget
        ) {
          return;
        }

        if (
          passwordValue.length <
          12
        ) {
          alert(
            "Password minimal 12 karakter."
          );
          return;
        }

        if (
          passwordValue !==
          passwordConfirm
        ) {
          alert(
            "Konfirmasi password tidak sama."
          );
          return;
        }

        if (
          !window.confirm(
            `Reset password untuk ${passwordTarget.full_name} (${passwordTarget.email})?`
          )
        ) {
          return;
        }

        setPasswordBusy(true);

        try {
          await resetAccountPassword(
            passwordTarget.profile_id,
            passwordValue
          );

          await navigator.clipboard
            ?.writeText(
              passwordValue
            )
            .catch(
              () => undefined
            );

          alert(
            `Password ${passwordTarget.full_name} berhasil direset.\n\nPassword baru sudah dicopy ke clipboard jika browser mengizinkan.`
          );

          closePasswordReset();
          await refresh();
        } catch (error) {
          console.error(error);

          alert(
            error instanceof Error
              ? error.message
              : "Reset password gagal."
          );
        } finally {
          setPasswordBusy(false);
        }
      };

    const handleTestNotification =
      async (
        account: AdminAccount
      ) => {
        if (
          !account.auth_user_id
        ) {
          alert(
            "Aktifkan akun terlebih dahulu."
          );
          return;
        }

        setTestBusyProfileId(
          account.profile_id
        );

        try {
          await sendAdminTestNotification(
            account.profile_id
          );

          alert(
            `Test notification berhasil dibuat untuk ${account.full_name}.\n\nIn-app notification sudah masuk ke inbox user. Email outbox juga otomatis dibuat dengan status PENDING sampai Microsoft Graph diaktifkan.`
          );
        } catch (error) {
          console.error(error);

          alert(
            error instanceof Error
              ? error.message
              : "Test notification gagal."
          );
        } finally {
          setTestBusyProfileId(
            null
          );
        }
      };

    const copyBulkCredentials =
      async () => {
        const lines =
          bulkSuccessful.map(
            (item) =>
              `${item.full_name}\t${item.email}\t${item.temporary_password || ""}`
          );

        if (
          lines.length === 0
        ) {
          alert(
            "Tidak ada credential baru untuk dicopy."
          );
          return;
        }

        try {
          await copyText(
            [
              "Nama\tEmail\tTemporary Password",
              ...lines,
            ].join("\n")
          );

          alert(
            "Credential berhasil dicopy."
          );
        } catch {
          alert(
            "Browser tidak mengizinkan clipboard."
          );
        }
      };

    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Administrasi
                Sistem
              </h1>

              <p className="mt-1 text-xs text-gray-500">
                Account activation,
                password recovery,
                notification test,
                dan global reset.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={
                  handleBulkActivation
                }
                disabled={
                  bulkActivationBusy ||
                  pendingActivationCount ===
                    0
                }
              >
                <UserPlus className="mr-2 h-4 w-4" />
                {bulkActivationBusy
                  ? "Activating..."
                  : `Aktifkan Semua (${pendingActivationCount})`}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={
                  refresh
                }
                disabled={
                  loading
                }
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-black">
                      {
                        accounts.length
                      }
                    </div>
                    <div className="text-xs text-gray-500">
                      Profile Aktif
                    </div>
                  </div>
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-black">
                      {
                        activeCount
                      }
                    </div>
                    <div className="text-xs text-gray-500">
                      Auth Aktif
                    </div>
                  </div>
                  <ShieldCheck className="h-6 w-6 text-emerald-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-black">
                      {
                        pendingActivationCount
                      }
                    </div>
                    <div className="text-xs text-gray-500">
                      Belum Diaktifkan
                    </div>
                  </div>
                  <KeyRound className="h-6 w-6 text-amber-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-bold text-blue-900">
                <UserPlus className="h-5 w-5" />
                Aktivasi Akun Tanpa Email Invite
              </CardTitle>

              <CardDescription className="text-xs text-blue-800">
                SYSTEM_ADMIN dapat membuat Supabase Auth langsung dari profile yang sudah ada. Setiap akun mendapat temporary password unik. Tidak menggunakan Supabase email invite dan tidak terkena email rate limit.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-rose-200 bg-rose-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-bold text-rose-900">
                <Database className="h-5 w-5" />
                Global Data Reset
              </CardTitle>

              <CardDescription className="text-xs text-rose-800">
                Menghapus seluruh
                data bisnis/UAT
                Supabase-native,
                attachment Activity,
                dan memicu reset
                data UAT browser
                untuk semua akun.
                Auth users dan
                struktur profile
                tetap tersedia.
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-2">
              <Button
                type="button"
                variant="outline"
                className="border-rose-300 text-rose-800 hover:bg-rose-100"
                onClick={
                  handleGlobalReset
                }
                disabled={
                  resetBusy
                }
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                {resetBusy
                  ? "Resetting..."
                  : "Reset Seluruh Data Global"}
              </Button>
            </CardContent>
          </Card>

          <Tabs
            defaultValue="accounts"
            className="w-full"
          >
            <TabsList className="grid w-full max-w-xl grid-cols-3 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
              <TabsTrigger
                value="accounts"
                className="text-xs font-bold"
              >
                Account & Password
              </TabsTrigger>

              <TabsTrigger
                value="products"
                className="text-xs font-bold"
              >
                Master Produk
              </TabsTrigger>

              <TabsTrigger
                value="audit"
                className="text-xs font-bold"
              >
                Audit Log
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="accounts"
              className="mt-4"
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">
                    Supabase Account
                    Directory
                  </CardTitle>

                  <CardDescription className="text-xs">
                    Aktifkan akun,
                    reset password,
                    atau kirim test
                    notification langsung
                    dari SYSTEM_ADMIN.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full min-w-[1250px] text-left text-xs">
                      <thead className="bg-gray-50 text-[10px] uppercase text-gray-600">
                        <tr>
                          <th className="p-3">
                            Nama
                          </th>
                          <th className="p-3">
                            Email
                          </th>
                          <th className="p-3">
                            Role
                          </th>
                          <th className="p-3">
                            Unit / Dept
                          </th>
                          <th className="p-3">
                            Manager
                          </th>
                          <th className="p-3">
                            Auth
                          </th>
                          <th className="p-3">
                            Last Sign In
                          </th>
                          <th className="p-3">
                            Action
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-gray-100">
                        {accounts.map(
                          (
                            account
                          ) => (
                            <tr
                              key={
                                account.profile_id
                              }
                            >
                              <td className="p-3 font-semibold">
                                {
                                  account.full_name
                                }
                              </td>

                              <td className="p-3">
                                {
                                  account.email
                                }
                              </td>

                              <td className="p-3">
                                <Badge variant="outline">
                                  {
                                    account.role_level
                                  }
                                </Badge>
                              </td>

                              <td className="p-3">
                                {
                                  account.department ||
                                  account.unit
                                }
                              </td>

                              <td className="p-3">
                                {
                                  account.manager_name ||
                                  "-"
                                }
                              </td>

                              <td className="p-3">
                                {
                                  ACCOUNT_STATUS_LABELS[
                                    account.account_status
                                  ]
                                }
                              </td>

                              <td className="p-3">
                                {account.last_sign_in_at
                                  ? new Date(
                                      account.last_sign_in_at
                                    ).toLocaleString(
                                      "id-ID"
                                    )
                                  : "-"}
                              </td>

                              <td className="p-3">
                                <div className="flex flex-wrap gap-2">
                                  {!account.auth_user_id ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={() =>
                                        openActivation(
                                          account
                                        )
                                      }
                                    >
                                      <UserPlus className="mr-1.5 h-4 w-4" />
                                      Aktifkan
                                    </Button>
                                  ) : (
                                    <>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                          openPasswordReset(
                                            account
                                          )
                                        }
                                      >
                                        <KeyRound className="mr-1.5 h-4 w-4" />
                                        Reset Password
                                      </Button>

                                      {account.role_level
                                        .trim()
                                        .toUpperCase() !==
                                        "SYSTEM_ADMIN" && (
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          disabled={
                                            testBusyProfileId ===
                                            account.profile_id
                                          }
                                          onClick={() =>
                                            handleTestNotification(
                                              account
                                            )
                                          }
                                        >
                                          <BellRing className="mr-1.5 h-4 w-4" />
                                          {testBusyProfileId ===
                                          account.profile_id
                                            ? "Sending..."
                                            : "Test Notif"}
                                        </Button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent
              value="products"
              className="mt-4"
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">
                    Master Produk
                  </CardTitle>
                </CardHeader>

                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 text-[10px] uppercase text-gray-600">
                        <tr>
                          <th className="p-3">
                            Kode
                          </th>
                          <th className="p-3">
                            Nama Produk
                          </th>
                          <th className="p-3">
                            Jenis
                          </th>
                          <th className="p-3">
                            Kategori
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-gray-100">
                        {products.map(
                          (
                            product
                          ) => (
                            <tr
                              key={
                                product.id
                              }
                            >
                              <td className="p-3 font-mono font-bold text-blue-700">
                                {
                                  product.productCode
                                }
                              </td>
                              <td className="p-3 font-semibold">
                                {
                                  product.productName
                                }
                              </td>
                              <td className="p-3">
                                {
                                  product.insuranceType
                                }
                              </td>
                              <td className="p-3">
                                {
                                  product.customerCategory
                                }
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent
              value="audit"
              className="mt-4"
            >
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm">
                      Legacy Audit
                      Trail
                    </CardTitle>

                    <CardDescription className="text-xs">
                      Audit UAT
                      browser legacy.
                    </CardDescription>
                  </div>

                  <ExcelExportButton
                    data={auditLogs.map(
                      (
                        log
                      ) => ({
                        Timestamp:
                          log.timestamp,
                        User:
                          log.userName,
                        Role:
                          log.userRole,
                        Module:
                          log.module,
                        Action:
                          log.action,
                        Record:
                          log.recordId,
                      })
                    )}
                    filename="System_Audit_Log"
                    label="Export Audit Log"
                  />
                </CardHeader>

                <CardContent>
                  {auditLogs.length ===
                  0 ? (
                    <div className="p-12 text-center text-xs text-gray-400">
                      Belum ada
                      audit log.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-gray-50 text-[10px] uppercase text-gray-600">
                          <tr>
                            <th className="p-3">
                              Waktu
                            </th>
                            <th className="p-3">
                              User
                            </th>
                            <th className="p-3">
                              Modul
                            </th>
                            <th className="p-3">
                              Action
                            </th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-100">
                          {auditLogs.map(
                            (
                              log
                            ) => (
                              <tr
                                key={
                                  log.id
                                }
                              >
                                <td className="p-3">
                                  {new Date(
                                    log.timestamp
                                  ).toLocaleString(
                                    "id-ID"
                                  )}
                                </td>
                                <td className="p-3 font-semibold">
                                  {
                                    log.userName
                                  }
                                </td>
                                <td className="p-3">
                                  {
                                    log.module
                                  }
                                </td>
                                <td className="p-3">
                                  {
                                    log.action
                                  }
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <Dialog
          open={
            Boolean(
              activationTarget
            )
          }
          onOpenChange={(
            open
          ) => {
            if (!open) {
              closeActivation();
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Aktifkan Akun
              </DialogTitle>

              <DialogDescription>
                {activationTarget
                  ? `${activationTarget.full_name} — ${activationTarget.email}`
                  : ""}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div>
                <div className="mb-1.5 text-xs font-bold text-gray-700">
                  Temporary Password
                </div>

                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={
                      activationPassword
                    }
                    onChange={(
                      event
                    ) =>
                      setActivationPassword(
                        event.target
                          .value
                      )
                    }
                  />

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setActivationPassword(
                        makePassword()
                      )
                    }
                  >
                    Generate
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-[11px] leading-5 text-blue-800">
                Auth user dibuat langsung oleh backend SYSTEM_ADMIN dengan email sudah confirmed. Tidak ada email invite yang dikirim.
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    await copyText(
                      activationPassword
                    );

                    alert(
                      "Password dicopy."
                    );
                  } catch {
                    alert(
                      "Browser tidak mengizinkan clipboard."
                    );
                  }
                }}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy Password
              </Button>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={
                  closeActivation
                }
                disabled={
                  activationBusy
                }
              >
                Batal
              </Button>

              <Button
                type="button"
                onClick={
                  handleActivation
                }
                disabled={
                  activationBusy
                }
              >
                {activationBusy
                  ? "Activating..."
                  : "Aktifkan Akun"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={
            bulkResults.length >
            0
          }
          onOpenChange={(
            open
          ) => {
            if (!open) {
              setBulkResults(
                []
              );
            }
          }}
        >
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>
                Hasil Bulk Activation
              </DialogTitle>

              <DialogDescription>
                Temporary password tidak disimpan di database. Copy sekarang sebelum menutup dialog.
              </DialogDescription>
            </DialogHeader>

            <div className="max-h-[460px] overflow-auto rounded-xl border border-gray-200">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="sticky top-0 bg-gray-50 text-[10px] uppercase text-gray-600">
                  <tr>
                    <th className="p-3">
                      Nama
                    </th>
                    <th className="p-3">
                      Email
                    </th>
                    <th className="p-3">
                      Status
                    </th>
                    <th className="p-3">
                      Temporary Password
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {bulkResults.map(
                    (
                      item
                    ) => (
                      <tr
                        key={
                          item.profile_id
                        }
                      >
                        <td className="p-3 font-semibold">
                          {
                            item.full_name
                          }
                        </td>
                        <td className="p-3">
                          {
                            item.email
                          }
                        </td>
                        <td className="p-3">
                          <Badge
                            variant="outline"
                          >
                            {
                              item.status
                            }
                          </Badge>

                          {item.error && (
                            <div className="mt-1 max-w-[260px] text-[10px] text-rose-600">
                              {
                                item.error
                              }
                            </div>
                          )}
                        </td>
                        <td className="p-3 font-mono">
                          {
                            item.temporary_password ||
                            "-"
                          }
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={
                  copyBulkCredentials
                }
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy Semua Credential
              </Button>

              <Button
                type="button"
                onClick={() =>
                  setBulkResults(
                    []
                  )
                }
              >
                Selesai
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={
            Boolean(
              passwordTarget
            )
          }
          onOpenChange={(
            open
          ) => {
            if (!open) {
              closePasswordReset();
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Reset Password
              </DialogTitle>

              <DialogDescription>
                {passwordTarget
                  ? `${passwordTarget.full_name} — ${passwordTarget.email}`
                  : ""}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div>
                <div className="mb-1.5 text-xs font-bold text-gray-700">
                  Password Baru
                </div>

                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={
                      passwordValue
                    }
                    onChange={(
                      event
                    ) =>
                      setPasswordValue(
                        event.target
                          .value
                      )
                    }
                  />

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setPasswordValue(
                        makePassword()
                      )
                    }
                  >
                    Generate
                  </Button>
                </div>
              </div>

              <div>
                <div className="mb-1.5 text-xs font-bold text-gray-700">
                  Konfirmasi
                  Password
                </div>

                <Input
                  type="text"
                  value={
                    passwordConfirm
                  }
                  onChange={(
                    event
                  ) =>
                    setPasswordConfirm(
                      event.target
                        .value
                    )
                  }
                />
              </div>

              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800">
                <KeyRound className="mt-0.5 h-4 w-4 shrink-0" />
                Password tidak
                dikirim otomatis.
                Admin harus
                menyampaikan
                langsung kepada
                user melalui kanal
                internal yang aman.
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    await copyText(
                      passwordValue
                    );

                    alert(
                      "Password dicopy."
                    );
                  } catch {
                    alert(
                      "Browser tidak mengizinkan clipboard."
                    );
                  }
                }}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy Password
              </Button>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={
                  closePasswordReset
                }
                disabled={
                  passwordBusy
                }
              >
                Batal
              </Button>

              <Button
                type="button"
                onClick={
                  handlePasswordReset
                }
                disabled={
                  passwordBusy
                }
              >
                {passwordBusy
                  ? "Resetting..."
                  : "Reset Password"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AppLayout>
    );
  };

export default AdministrasiPage;
