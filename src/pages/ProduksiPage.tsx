import React, { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  store,
  OfficialProductionBatch,
  OfficialProductionImportRecord,
  OfficialProductionSummary,
} from '@/services/store';
import {
  Pipeline,
  ProductionTransaction,
  User,
} from '@/types';
import {
  formatRupiah,
  formatDate,
} from '@/utils/formatters';
import {
  formatRupiahInput,
  sanitizeRupiahInput,
} from '@/utils/currencyInput';
import { StatusBadge } from '@/components/common/StatusBadge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Plus,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type ValidationSeverity =
  | 'ERROR'
  | 'WARNING';

interface ValidationIssue {
  rowNumber: number;
  severity: ValidationSeverity;
  message: string;
}

interface ParsedProductionFile {
  sourceRowCount: number;
  validRecords: OfficialProductionImportRecord[];
  ignoredRowCount: number;
  warningRowCount: number;
  errorRowCount: number;
  issues: ValidationIssue[];
}

const TEMPLATE_HEADERS = [
  'Tahun Produksi',
  'Bulan Produksi',
  'Nomor Polis',
  'Nama Nasabah',
  'Nama Produk',
  'Realisasi Produksi (Rp)',
  'Fungsi Marketing',
  'Jenis Bisnis',
  'PIC Marketing',
];

// Backward-compatible validator:
// the two new lookup fields are shown in the downloaded template,
// while old 7-column UAT files can still be validated. When Nomor
// Polis is blank/missing the app generates a deterministic dummy
// policy number for UAT and surfaces a warning.
const REQUIRED_TEMPLATE_HEADERS = [
  'Tahun Produksi',
  'Bulan Produksi',
  'Nama Produk',
  'Realisasi Produksi (Rp)',
  'Fungsi Marketing',
  'Jenis Bisnis',
  'PIC Marketing',
];

const normalizeHeader = (
  value: string
) =>
  String(
    value || ''
  )
    .replace(
      /^\uFEFF/,
      ''
    )
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      ''
    );

const detectDelimiter = (
  text: string
) => {
  const firstLine =
    text
      .split(
        /\r?\n/
      )[0] || '';

  let semicolonCount =
    0;

  let commaCount =
    0;

  let inQuotes =
    false;

  for (
    let index = 0;
    index <
    firstLine.length;
    index += 1
  ) {
    const char =
      firstLine[index];

    if (
      char === '"'
    ) {
      inQuotes =
        !inQuotes;

      continue;
    }

    if (
      inQuotes
    ) {
      continue;
    }

    if (
      char === ';'
    ) {
      semicolonCount +=
        1;
    }

    if (
      char === ','
    ) {
      commaCount +=
        1;
    }
  }

  return semicolonCount >=
    commaCount
    ? ';'
    : ',';
};

const parseCsv = (
  text: string
): string[][] => {
  const delimiter =
    detectDelimiter(
      text
    );

  const rows:
    string[][] = [];

  let row:
    string[] = [];

  let cell =
    '';

  let inQuotes =
    false;

  for (
    let index = 0;
    index <
    text.length;
    index += 1
  ) {
    const char =
      text[index];

    const next =
      text[
        index + 1
      ];

    if (
      char === '"'
    ) {
      if (
        inQuotes &&
        next === '"'
      ) {
        cell +=
          '"';

        index +=
          1;
      } else {
        inQuotes =
          !inQuotes;
      }

      continue;
    }

    if (
      char ===
        delimiter &&
      !inQuotes
    ) {
      row.push(
        cell
      );

      cell =
        '';

      continue;
    }

    if (
      (
        char === '\n' ||
        char === '\r'
      ) &&
      !inQuotes
    ) {
      if (
        char === '\r' &&
        next === '\n'
      ) {
        index +=
          1;
      }

      row.push(
        cell
      );

      const hasValue =
        row.some(
          value =>
            String(
              value
            ).trim() !==
            ''
        );

      if (
        hasValue
      ) {
        rows.push(
          row
        );
      }

      row =
        [];

      cell =
        '';

      continue;
    }

    cell +=
      char;
  }

  if (
    cell.length >
      0 ||
    row.length >
      0
  ) {
    row.push(
      cell
    );

    if (
      row.some(
        value =>
          String(
            value
          ).trim() !==
          ''
      )
    ) {
      rows.push(
        row
      );
    }
  }

  return rows;
};

const parseProductionMonth = (
  value: string
) => {
  const raw =
    String(
      value || ''
    )
      .trim()
      .toLowerCase();

  const numeric =
    Number(
      raw
    );

  if (
    Number.isInteger(
      numeric
    ) &&
    numeric >= 1 &&
    numeric <= 12
  ) {
    return numeric;
  }

  const aliases:
    Record<
      string,
      number
    > = {
      januari: 1,
      jan: 1,
      februari: 2,
      feb: 2,
      maret: 3,
      mar: 3,
      april: 4,
      apr: 4,
      mei: 5,
      may: 5,
      juni: 6,
      jun: 6,
      juli: 7,
      jul: 7,
      agustus: 8,
      agu: 8,
      ags: 8,
      aug: 8,
      september: 9,
      sep: 9,
      oktober: 10,
      okt: 10,
      oct: 10,
      november: 11,
      nov: 11,
      desember: 12,
      des: 12,
      dec: 12,
    };

  return aliases[
    raw.replace(
      /\./g,
      ''
    )
  ] || 0;
};

const parseRupiah = (
  value: string
): number | null => {
  const raw =
    String(
      value ?? ''
    )
      .trim();

  if (
    raw === ''
  ) {
    return null;
  }

  let cleaned =
    raw
      .replace(
        /rp/gi,
        ''
      )
      .replace(
        /\s/g,
        ''
      );

  const isNegative =
    cleaned.startsWith(
      '('
    ) &&
    cleaned.endsWith(
      ')'
    );

  cleaned =
    cleaned
      .replace(
        /[()]/g,
        ''
      );

  const thousandsLike =
    /^-?\d{1,3}([.,]\d{3})+$/;

  if (
    thousandsLike.test(
      cleaned
    )
  ) {
    cleaned =
      cleaned.replace(
        /[.,]/g,
        ''
      );
  } else if (
    cleaned.includes(
      ','
    ) &&
    cleaned.includes(
      '.'
    )
  ) {
    const lastComma =
      cleaned.lastIndexOf(
        ','
      );

    const lastDot =
      cleaned.lastIndexOf(
        '.'
      );

    if (
      lastComma >
      lastDot
    ) {
      cleaned =
        cleaned
          .replace(
            /\./g,
            ''
          )
          .replace(
            ',',
            '.'
          );
    } else {
      cleaned =
        cleaned.replace(
          /,/g,
          ''
        );
    }
  } else if (
    cleaned.includes(
      ','
    )
  ) {
    const parts =
      cleaned.split(
        ','
      );

    cleaned =
      parts.length === 2 &&
      parts[1].length <= 2
        ? cleaned.replace(
            ',',
            '.'
          )
        : cleaned.replace(
            /,/g,
            ''
          );
  }

  const parsed =
    Number(
      cleaned
    );

  if (
    !Number.isFinite(
      parsed
    )
  ) {
    return null;
  }

  const signed =
    isNegative
      ? -Math.abs(
          parsed
        )
      : parsed;

  return Math.round(
    signed
  );
};

const normalizeBusinessType = (
  value: string
):
  | 'New Business'
  | 'Renewal Business'
  | null => {
  const normalized =
    String(
      value || ''
    )
      .trim()
      .toLowerCase()
      .replace(
        /\s+/g,
        ' '
      );

  const compact =
    normalized.replace(
      /[^a-z]/g,
      ''
    );

  if (
    [
      'newbusiness',
      'newbisnis',
      'newbisinis',
      'firstyear',
    ].includes(
      compact
    )
  ) {
    return 'New Business';
  }

  if (
    [
      'renewal',
      'renewalbusiness',
      'lanjutan',
    ].includes(
      compact
    )
  ) {
    return 'Renewal Business';
  }

  return null;
};

const normalizeMarketingFunction = (
  value: string
):
  | 'Captive Marketing'
  | 'Corporate & Retail Marketing'
  | null => {
  const compact =
    String(
      value || ''
    )
      .trim()
      .toLowerCase()
      .replace(
        /[^a-z&]/g,
        ''
      );

  if (
    compact ===
    'captivemarketing'
  ) {
    return 'Captive Marketing';
  }

  if (
    compact ===
      'corporate&retailmarketing' ||
    compact ===
      'corporateretailmarketing'
  ) {
    return 'Corporate & Retail Marketing';
  }

  return null;
};

const periodLabel = (
  year: number,
  month: number
) => {
  const labels = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'Mei',
    'Jun',
    'Jul',
    'Agu',
    'Sep',
    'Okt',
    'Nov',
    'Des',
  ];

  return `${labels[
    month - 1
  ]} ${year}`;
};

export const ProduksiPage: React.FC = () => {
  const [
    currentUser,
    setCurrentUser,
  ] = useState<User>(
    store.getCurrentUser()
  );

  const [
    pipelines,
    setPipelines,
  ] = useState<
    Pipeline[]
  >([]);

  const [
    productions,
    setProductions,
  ] = useState<
    ProductionTransaction[]
  >([]);

  const [
    officialProductions,
    setOfficialProductions,
  ] = useState<
    OfficialProductionSummary[]
  >([]);

  const [
    officialBatches,
    setOfficialBatches,
  ] = useState<
    OfficialProductionBatch[]
  >([]);

  const [
    uploadFile,
    setUploadFile,
  ] = useState<
    File | null
  >(null);

  const [
    parsedUpload,
    setParsedUpload,
  ] = useState<
    ParsedProductionFile | null
  >(null);

  const [
    isValidating,
    setIsValidating,
  ] = useState(
    false
  );

  const [
    selectedOfficialYear,
    setSelectedOfficialYear,
  ] = useState<number>(
    2026
  );

  // Form Invoice Record State
  const [
    selectedWinPipeline,
    setSelectedWinPipeline,
  ] = useState<
    Pipeline | null
  >(null);

  const [
    corePolicyNumber,
    setCorePolicyNumber,
  ] = useState(
    ''
  );

  const [
    coreInvoiceNumber,
    setCoreInvoiceNumber,
  ] = useState(
    ''
  );

  const [
    invoiceAmount,
    setInvoiceAmount,
  ] = useState(
    ''
  );

  const [
    invoiceDate,
    setInvoiceDate,
  ] = useState(
    new Date()
      .toISOString()
      .split('T')[0]
  );

  useEffect(
    () => {
      const refresh =
        () => {
          setCurrentUser(
            store.getCurrentUser()
          );

          setPipelines(
            store.getPipelines()
          );

          setProductions(
            store.getProductions()
          );

          const official =
            store.getOfficialProductionSummaries();

          setOfficialProductions(
            official
          );

          setOfficialBatches(
            store.getOfficialProductionBatches()
          );

          if (
            official.length >
            0
          ) {
            setSelectedOfficialYear(
              Math.max(
                ...official.map(
                  row =>
                    row.productionYear
                )
              )
            );
          }
        };

      refresh();

      return store.subscribe(
        refresh
      );
    },
    []
  );

  const isArianie =
    currentUser.id ===
    'USR-000024';

  const isMS =
    currentUser.unit ===
      'Marketing Support' ||
    currentUser.role ===
      'SYSTEM_ADMIN';

  const winPipelines =
    pipelines.filter(
      pipeline =>
        pipeline.status ===
        'WIN'
    );

  const officialYears =
    useMemo(
      () =>
        Array.from(
          new Set(
            officialProductions.map(
              row =>
                row.productionYear
            )
          )
        ).sort(
          (
            first,
            second
          ) =>
            Number(
              second
            ) -
            Number(
              first
            )
        ),
      [
        officialProductions,
      ]
    );

  const officialYearRows =
    officialProductions.filter(
      row =>
        row.productionYear ===
        selectedOfficialYear
    );

  const officialTotal =
    officialYearRows.reduce(
      (
        sum,
        row
      ) =>
        sum +
        Number(
          row.productionAmount ||
          0
        ),
      0
    );

  const officialNB =
    officialYearRows
      .filter(
        row =>
          row.businessType ===
          'New Business'
      )
      .reduce(
        (
          sum,
          row
        ) =>
          sum +
          row.productionAmount,
        0
      );

  const officialRN =
    officialYearRows
      .filter(
        row =>
          row.businessType ===
          'Renewal Business'
      )
      .reduce(
        (
          sum,
          row
        ) =>
          sum +
          row.productionAmount,
        0
      );

  const officialTransactionCount =
    officialYearRows.reduce(
      (
        sum,
        row
      ) =>
        sum +
        Number(
          row.transactionCount ||
          0
        ),
      0
    );

  const officialMonthly =
    Array.from(
      {
        length: 12,
      },
      (
        _,
        index
      ) => {
        const month =
          index + 1;

        const rows =
          officialYearRows.filter(
            row =>
              row.productionMonth ===
              month
          );

        return {
          month,
          label:
            periodLabel(
              selectedOfficialYear,
              month
            ).split(' ')[0],
          amount:
            rows.reduce(
              (
                sum,
                row
              ) =>
                sum +
                row.productionAmount,
              0
            ),
          transactions:
            rows.reduce(
              (
                sum,
                row
              ) =>
                sum +
                row.transactionCount,
              0
            ),
        };
      }
    );

  const getRowValue = (
    row:
      Record<
        string,
        string
      >,
    ...aliases:
      string[]
  ) => {
    for (
      const alias of
      aliases
    ) {
      const key =
        Object.keys(
          row
        ).find(
          candidate =>
            normalizeHeader(
              candidate
            ) ===
            normalizeHeader(
              alias
            )
        );

      if (
        key
      ) {
        return String(
          row[key] ??
            ''
        ).trim();
      }
    }

    return '';
  };

  const handleDownloadCsvTemplate =
    () => {
      const csv =
        '\uFEFF' +
        TEMPLATE_HEADERS
          .map(
            header =>
              `"${header.replace(
                /"/g,
                '""'
              )}"`
          )
          .join(
            ';'
          ) +
        '\r\n';

      const blob =
        new Blob(
          [
            csv,
          ],
          {
            type:
              'text/csv;charset=utf-8;',
          }
        );

      const url =
        URL.createObjectURL(
          blob
        );

      const anchor =
        document.createElement(
          'a'
        );

      anchor.href =
        url;

      anchor.download =
        'Template_Upload_Realisasi_Produksi_Dashboard_9_Kolom.csv';

      document.body.appendChild(
        anchor
      );

      anchor.click();

      anchor.remove();

      URL.revokeObjectURL(
        url
      );
    };

  const handleValidateUpload =
    async () => {
      if (
        !uploadFile
      ) {
        return;
      }

      setIsValidating(
        true
      );

      try {
        const text =
          await uploadFile.text();

        const parsedRows =
          parseCsv(
            text
          );

        if (
          parsedRows.length <
          2
        ) {
          throw new Error(
            'CSV tidak memiliki baris data.'
          );
        }

        const headers =
          parsedRows[0].map(
            value =>
              String(
                value
              ).trim()
          );

        const normalizedHeaders =
          new Set(
            headers.map(
              normalizeHeader
            )
          );

        const requiredHeaders =
          REQUIRED_TEMPLATE_HEADERS.map(
            normalizeHeader
          );

        const missingHeaders =
          requiredHeaders.filter(
            header =>
              !normalizedHeaders.has(
                header
              )
          );

        if (
          missingHeaders.length >
          0
        ) {
          throw new Error(
            'Header CSV tidak sesuai Template Dashboard. Pastikan file berasal dari template Realisasi Produksi terbaru.'
          );
        }

        const products =
          store.getProducts();

        const users =
          store
            .getUsers()
            .filter(
              user =>
                user.role !==
                'SYSTEM_ADMIN'
            );

        const validRecords:
          OfficialProductionImportRecord[] =
          [];

        const issues:
          ValidationIssue[] =
          [];

        const issueRows =
          new Set<
            number
          >();

        let ignoredRowCount =
          0;

        let warningRowCount =
          0;

        let errorRowCount =
          0;

        parsedRows
          .slice(
            1
          )
          .forEach(
            (
              values,
              dataIndex
            ) => {
              const rowNumber =
                dataIndex +
                2;

              const row:
                Record<
                  string,
                  string
                > = {};

              headers.forEach(
                (
                  header,
                  columnIndex
                ) => {
                  row[
                    header
                  ] =
                    values[
                      columnIndex
                    ] ?? '';
                }
              );

              const year =
                Number(
                  getRowValue(
                    row,
                    'Tahun Produksi',
                    'Tahun'
                  )
                );

              const month =
                parseProductionMonth(
                  getRowValue(
                    row,
                    'Bulan Produksi',
                    'Bulan'
                  )
                );

              const amountRaw =
                getRowValue(
                  row,
                  'Realisasi Produksi (Rp)',
                  'TOTAL Piutang'
                );

              if (
                amountRaw ===
                ''
              ) {
                ignoredRowCount +=
                  1;

                if (
                  issues.length <
                  200
                ) {
                  issues.push({
                    rowNumber,
                    severity:
                      'WARNING',
                    message:
                      'Nominal Realisasi Produksi kosong — row di-ignore saat publish.',
                  });
                }

                warningRowCount +=
                  1;

                return;
              }

              const amount =
                parseRupiah(
                  amountRaw
                );

              const functionValue =
                normalizeMarketingFunction(
                  getRowValue(
                    row,
                    'Fungsi Marketing',
                    'DISTRIBUSI PEMASARAN'
                  )
                );

              const businessType =
                normalizeBusinessType(
                  getRowValue(
                    row,
                    'Jenis Bisnis',
                    'STATUS PREMI'
                  )
                );

              const productRaw =
                getRowValue(
                  row,
                  'Nama Produk',
                  'PRODUK'
                );

              const customerRaw =
                getRowValue(
                  row,
                  'Nama Nasabah',
                  'Nama Pemegang Polis',
                  'PERUSAHAAN'
                );

              const policyRaw =
                getRowValue(
                  row,
                  'Nomor Polis',
                  'NO POLIS'
                );

              const generatedPolicyNumber =
                `DUMMY-POL-${Number.isInteger(year) ? year : 'YYYY'}${month ? String(month).padStart(2, '0') : 'MM'}-${String(rowNumber).padStart(6, '0')}`;

              const policyNumber =
                policyRaw ||
                generatedPolicyNumber;

              const resolvedCustomerName =
                customerRaw ||
                (
                  policyRaw
                    ? `Existing Client - ${policyNumber}`
                    : `Existing Client Dummy - ${productRaw || 'Produk'}`
                );

              const rowErrors:
                string[] = [];

              const rowWarnings:
                string[] = [];

              if (
                !policyRaw
              ) {
                rowWarnings.push(
                  `Nomor Polis kosong. Sistem membuat dummy UAT ${generatedPolicyNumber}.`
                );
              }

              if (
                !customerRaw
              ) {
                rowWarnings.push(
                  `Nama Nasabah kosong. Lookup Existing Client akan memakai label "${resolvedCustomerName}".`
                );
              }

              if (
                !Number.isInteger(
                  year
                ) ||
                year <
                  2000 ||
                year >
                  2100
              ) {
                rowErrors.push(
                  'Tahun Produksi tidak valid'
                );
              }

              if (
                month <
                  1 ||
                month >
                  12
              ) {
                rowErrors.push(
                  'Bulan Produksi tidak valid'
                );
              }

              if (
                amount ===
                null
              ) {
                rowErrors.push(
                  'Realisasi Produksi bukan angka yang valid'
                );
              }

              if (
                !functionValue
              ) {
                rowErrors.push(
                  'Fungsi Marketing harus Captive Marketing atau Corporate & Retail Marketing'
                );
              }

              if (
                !businessType
              ) {
                rowErrors.push(
                  'Jenis Bisnis tidak dapat dimapping ke New Business / Renewal'
                );
              }

              if (
                !productRaw
              ) {
                rowErrors.push(
                  'Nama Produk kosong'
                );
              }

              if (
                rowErrors.length >
                0
              ) {
                errorRowCount +=
                  1;

                issueRows.add(
                  rowNumber
                );

                if (
                  issues.length <
                  200
                ) {
                  issues.push({
                    rowNumber,
                    severity:
                      'ERROR',
                    message:
                      rowErrors.join(
                        '; '
                      ),
                  });
                }

                return;
              }

              const normalizedProductInput =
                store.normalizeProductName(
                  productRaw
                );

              const productMasterMatch =
                products.find(
                  product =>
                    product.productName
                      .trim()
                      .toLowerCase() ===
                    normalizedProductInput
                      .trim()
                      .toLowerCase()
                );

              const productName =
                productMasterMatch
                  ? productMasterMatch.productName
                  : normalizedProductInput;

              if (
                !productMasterMatch
              ) {
                rowWarnings.push(
                  `Produk "${productRaw}" tidak ditemukan di Product Master aktif; nama source tetap dipertahankan`
                );
              }

              const picRaw =
                getRowValue(
                  row,
                  'PIC Marketing',
                  'PIC'
                );

              const picIsEmpty =
                !picRaw ||
                picRaw
                  .trim()
                  .toLowerCase() ===
                  '#n/a';

              const picMatch =
                picIsEmpty
                  ? undefined
                  : users.find(
                      user =>
                        user.name
                          .trim()
                          .toLowerCase() ===
                        picRaw
                          .trim()
                          .toLowerCase()
                    );

              const picName =
                picIsEmpty
                  ? 'Unassigned / Data Historis'
                  : picRaw;

              if (
                !picIsEmpty &&
                !picMatch
              ) {
                rowWarnings.push(
                  `PIC "${picRaw}" tidak ditemukan di User Master; transaksi tetap dihitung tanpa PIC User ID`
                );
              }

              let department =
                'Unassigned / Data Historis';

              if (
                picMatch &&
                picMatch.unit ===
                  functionValue
              ) {
                department =
                  picMatch.department ||
                  'None';
              }

              if (
                rowWarnings.length >
                0
              ) {
                warningRowCount +=
                  1;

                issueRows.add(
                  rowNumber
                );

                if (
                  issues.length <
                  200
                ) {
                  issues.push({
                    rowNumber,
                    severity:
                      'WARNING',
                    message:
                      rowWarnings.join(
                        '; '
                      ),
                  });
                }
              }

              validRecords.push({
                productionYear:
                  year,
                productionMonth:
                  month,
                policyNumber,
                customerName:
                  resolvedCustomerName,
                noteNumber:
                  getRowValue(
                    row,
                    'Nomor Nota',
                    'NO NOTA'
                  ),
                productName,
                coverageStart:
                  getRowValue(
                    row,
                    'Tanggal Mulai Polis',
                    'TANGGAL MULAI POLIS'
                  ),
                coverageEnd:
                  getRowValue(
                    row,
                    'Tanggal Akhir Polis',
                    'TANGGAL AKHIR POLIS'
                  ),
                productionAmount:
                  amount as number,
                marketingFunction:
                  functionValue as
                    | 'Captive Marketing'
                    | 'Corporate & Retail Marketing',
                businessType:
                  businessType as
                    | 'New Business'
                    | 'Renewal Business',
                picName:
                  picMatch
                    ? picMatch.name
                    : picName,
                picUserId:
                  picMatch?.id,
                department,
              });
            }
          );

        setParsedUpload({
          sourceRowCount:
            parsedRows.length -
            1,
          validRecords,
          ignoredRowCount,
          warningRowCount,
          errorRowCount,
          issues,
        });
      } catch (
        error
      ) {
        console.error(
          'Validasi Realisasi Produksi gagal:',
          error
        );

        alert(
          error instanceof
            Error
            ? error.message
            : 'Validasi CSV gagal.'
        );

        setParsedUpload(
          null
        );
      } finally {
        setIsValidating(
          false
        );
      }
    };

  const uploadPeriodKeys =
    parsedUpload
      ? Array.from(
          new Set(
            parsedUpload.validRecords.map(
              record =>
                `${record.productionYear}-${String(
                  record.productionMonth
                ).padStart(2, '0')}`
            )
          )
        ).sort()
      : [];

  const overlappingPeriodKeys =
    uploadPeriodKeys.filter(
      periodKey =>
        officialProductions.some(
          summary =>
            `${summary.productionYear}-${String(
              summary.productionMonth
            ).padStart(2, '0')}` ===
            periodKey
        )
    );

  const uploadTotal =
    parsedUpload
      ? parsedUpload.validRecords.reduce(
          (
            sum,
            row
          ) =>
            sum +
            row.productionAmount,
          0
        )
      : 0;

  const uploadNB =
    parsedUpload
      ? parsedUpload.validRecords
          .filter(
            row =>
              row.businessType ===
              'New Business'
          )
          .reduce(
            (
              sum,
              row
            ) =>
              sum +
              row.productionAmount,
            0
          )
      : 0;

  const uploadRN =
    parsedUpload
      ? parsedUpload.validRecords
          .filter(
            row =>
              row.businessType ===
              'Renewal Business'
          )
          .reduce(
            (
              sum,
              row
            ) =>
              sum +
              row.productionAmount,
            0
          )
      : 0;

  const handlePublishOfficial =
    () => {
      if (
        !isArianie ||
        !uploadFile ||
        !parsedUpload ||
        parsedUpload.validRecords.length ===
          0
      ) {
        return;
      }

      if (
        parsedUpload.errorRowCount >
        0
      ) {
        alert(
          'Masih ada row ERROR. Perbaiki source CSV lalu validasi ulang sebelum Publish.'
        );

        return;
      }

      const confirmation =
        overlappingPeriodKeys.length >
        0
          ? `Periode ${overlappingPeriodKeys.join(
              ', '
            )} sudah pernah dipublish dan akan DI-REPLACE. Lanjutkan?`
          : `Publish ${parsedUpload.validRecords.length} baris valid untuk periode ${uploadPeriodKeys.join(
              ', '
            )}?`;

      if (
        !confirm(
          confirmation
        )
      ) {
        return;
      }

      const now =
        new Date();

      const batch:
        OfficialProductionBatch = {
          id:
            `OPB-${now.getFullYear()}${String(
              now.getMonth() +
                1
            ).padStart(
              2,
              '0'
            )}${String(
              now.getDate()
            ).padStart(
              2,
              '0'
            )}-${String(
              now.getTime()
            ).slice(
              -6
            )}`,
          filename:
            uploadFile.name,
          uploadedByUserId:
            currentUser.id,
          uploadedByName:
            currentUser.name,
          uploadedAt:
            now.toISOString(),
          sourceRowCount:
            parsedUpload.sourceRowCount,
          validRowCount:
            parsedUpload.validRecords.length,
          ignoredRowCount:
            parsedUpload.ignoredRowCount,
          warningRowCount:
            parsedUpload.warningRowCount,
          publishedPeriodKeys:
            uploadPeriodKeys,
          totalProductionAmount:
            uploadTotal,
          status:
            'Published',
        };

      try {
        store.publishOfficialProductionSnapshot(
          batch,
          parsedUpload.validRecords
        );

        alert(
          `Realisasi Produksi berhasil dipublish.\n\nPeriode: ${uploadPeriodKeys.join(
            ', '
          )}\nValid: ${parsedUpload.validRecords.length} row\nTotal: ${formatRupiah(
            uploadTotal
          )}`
        );

        setUploadFile(
          null
        );

        setParsedUpload(
          null
        );
      } catch (
        error
      ) {
        console.error(
          'Publish Realisasi Produksi gagal:',
          error
        );

        alert(
          error instanceof
            Error
            ? error.message
            : 'Publish Realisasi Produksi gagal.'
        );
      }
    };

  const handleRecordInvoice =
    (
      event:
        React.FormEvent
    ) => {
      event.preventDefault();

      if (
        !selectedWinPipeline ||
        !coreInvoiceNumber ||
        !invoiceAmount
      ) {
        return;
      }

      const dateObj =
        new Date(
          invoiceDate
        );

      const prodMonth =
        dateObj.getMonth() +
        1;

      const prodYear =
        dateObj.getFullYear();

      const newProd:
        ProductionTransaction = {
          id:
            `PTX-${prodYear}-${Math.floor(
              10000 +
              Math.random() *
                90000
            )}`,
          pipelineId:
            selectedWinPipeline.id,
          customerName:
            selectedWinPipeline.customerName,
          productName:
            selectedWinPipeline.productName,
          picUserId:
            selectedWinPipeline.picUserId,
          picName:
            selectedWinPipeline.picName,
          unit:
            selectedWinPipeline.unit,
          department:
            selectedWinPipeline.department,
          businessType:
            selectedWinPipeline.businessType,
          corePolicyNumber:
            corePolicyNumber ||
            'Belum Terbit / Belum Diinput',
          coreInvoiceNumber,
          invoiceDate,
          productionMonth:
            prodMonth,
          productionYear:
            prodYear,
          invoiceAmount:
            Number(
              invoiceAmount
            ),
          transactionType:
            selectedWinPipeline.businessType ===
            'Renewal Business'
              ? 'Regular Renewal'
              : 'Initial Premium',
          makerUserId:
            currentUser.id,
          makerUserName:
            currentUser.name,
          makerTimestamp:
            new Date().toISOString(),
          status:
            'Pending Checker',
        };

      store.addProduction(
        newProd
      );

      setSelectedWinPipeline(
        null
      );

      setCorePolicyNumber(
        ''
      );

      setCoreInvoiceNumber(
        ''
      );

      setInvoiceAmount(
        ''
      );

      alert(
        `Transaksi Nota Tagihan ${newProd.id} berhasil dicatat! Menunggu verifikasi Checker MS.`
      );
    };

  const handleCheckerApprove =
    (
      prod:
        ProductionTransaction
    ) => {
      if (
        prod.makerUserId ===
          currentUser.id &&
        currentUser.role !==
          'SYSTEM_ADMIN'
      ) {
        alert(
          'Prinsip Maker-Checker: Pembuat transaksi tidak dapat memverifikasi transaksinya sendiri!'
        );

        return;
      }

      const updated:
        ProductionTransaction = {
          ...prod,
          status:
            'POSTED',
          checkerUserId:
            currentUser.id,
          checkerUserName:
            currentUser.name,
          checkerTimestamp:
            new Date().toISOString(),
        };

      store.updateProduction(
        updated
      );

      alert(
        'Transaksi invoice berhasil ter-POSTED. Dashboard realisasi official tetap mengikuti Upload Realisasi Produksi.'
      );
    };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Realisasi Produksi
            </h1>

            <p className="text-xs text-gray-500 mt-1">
              Realisasi Official menggunakan snapshot laporan produksi CSV yang dipublikasikan oleh Team Leader Marketing Support.
            </p>
          </div>

        </div>

        <Tabs
          defaultValue="official"
          className="w-full"
        >
          <TabsList
            className={`bg-white border border-gray-200 p-1 rounded-xl shadow-sm grid w-full ${
              isArianie
                ? 'grid-cols-2 max-w-xl'
                : 'grid-cols-1 max-w-sm'
            }`}
          >
            <TabsTrigger
              value="official"
              className="text-xs font-bold"
            >
              Realisasi Official
            </TabsTrigger>

            {isArianie && (
              <TabsTrigger
                value="upload_official"
                className="text-xs font-bold"
              >
                Upload Realisasi
              </TabsTrigger>
            )}
          </TabsList>

          {/* ===================================================
              TAB OFFICIAL PRODUCTION
          =================================================== */}
          <TabsContent
            value="official"
            className="space-y-4 mt-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Card className="border-gray-200">
                <CardContent className="p-4">
                  <p className="text-[10px] uppercase font-bold text-gray-500">
                    Realisasi {selectedOfficialYear}
                  </p>

                  <p className="text-lg font-bold text-gray-900 mt-1">
                    {formatRupiah(
                      officialTotal
                    )}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-gray-200">
                <CardContent className="p-4">
                  <p className="text-[10px] uppercase font-bold text-gray-500">
                    New Business
                  </p>

                  <p className="text-lg font-bold text-gray-900 mt-1">
                    {formatRupiah(
                      officialNB
                    )}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-gray-200">
                <CardContent className="p-4">
                  <p className="text-[10px] uppercase font-bold text-gray-500">
                    Renewal
                  </p>

                  <p className="text-lg font-bold text-gray-900 mt-1">
                    {formatRupiah(
                      officialRN
                    )}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-gray-200">
                <CardContent className="p-4">
                  <p className="text-[10px] uppercase font-bold text-gray-500">
                    Source Rows
                  </p>

                  <p className="text-lg font-bold text-gray-900 mt-1">
                    {officialTransactionCount.toLocaleString(
                      'id-ID'
                    )}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card className="border-gray-200">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-sm font-bold">
                      Produksi Bulanan Official
                    </CardTitle>

                    <CardDescription className="text-xs">
                      Actual produksi per Bulan Produksi dari snapshot terakhir yang dipublish.
                    </CardDescription>
                  </div>

                  <select
                    value={
                      selectedOfficialYear
                    }
                    onChange={
                      event =>
                        setSelectedOfficialYear(
                          Number(
                            event.target.value
                          )
                        )
                    }
                    className="h-9 rounded-md border border-gray-200 bg-white px-3 text-xs font-semibold"
                  >
                    {officialYears.length ===
                      0 && (
                      <option
                        value={2026}
                      >
                        2026
                      </option>
                    )}

                    {officialYears.map(
                      year => (
                        <option
                          key={
                            year
                          }
                          value={
                            year
                          }
                        >
                          {year}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </CardHeader>

              <CardContent>
                {officialProductions.length ===
                0 ? (
                  <div className="p-12 text-center text-xs text-gray-400">
                    Belum ada Realisasi Produksi Official yang dipublish.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 border-b border-gray-200 uppercase text-[10px] text-gray-600">
                        <tr>
                          <th className="p-3">
                            Bulan
                          </th>

                          <th className="p-3 text-right">
                            Realisasi
                          </th>

                          <th className="p-3 text-right">
                            Source Rows
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-gray-100">
                        {officialMonthly.map(
                          month => (
                            <tr
                              key={
                                month.month
                              }
                              className="hover:bg-gray-50"
                            >
                              <td className="p-3 font-bold text-gray-900">
                                {month.label}
                              </td>

                              <td className="p-3 text-right font-bold text-emerald-700">
                                {formatRupiah(
                                  month.amount
                                )}
                              </td>

                              <td className="p-3 text-right text-gray-600">
                                {month.transactions.toLocaleString(
                                  'id-ID'
                                )}
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

            {officialBatches.length >
              0 && (
              <Card className="border-gray-200">
                <CardHeader>
                  <CardTitle className="text-sm font-bold">
                    Riwayat Publish Snapshot
                  </CardTitle>

                  <CardDescription className="text-xs">
                    Re-upload periode yang sama mengganti snapshot periode tersebut, bukan menggandakan realisasi.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-2">
                  {officialBatches
                    .slice(
                      0,
                      10
                    )
                    .map(
                      batch => (
                        <div
                          key={
                            batch.id
                          }
                          className="p-3 rounded-lg border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-2"
                        >
                          <div>
                            <p className="text-xs font-bold text-gray-900">
                              {
                                batch.filename
                              }
                            </p>

                            <p className="text-[11px] text-gray-500 mt-1">
                              {new Date(
                                batch.uploadedAt
                              ).toLocaleString(
                                'id-ID'
                              )}{' '}
                              •{' '}
                              {batch.publishedPeriodKeys.join(
                                ', '
                              )}
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="text-xs font-bold text-gray-900">
                              {formatRupiah(
                                batch.totalProductionAmount
                              )}
                            </p>

                            <p className="text-[11px] text-gray-500">
                              {batch.validRowCount.toLocaleString(
                                'id-ID'
                              )}{' '}
                              valid rows
                            </p>
                          </div>
                        </div>
                      )
                    )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ===================================================
              TAB UPLOAD OFFICIAL — ARIANIE ONLY
          =================================================== */}
          {isArianie && (
            <TabsContent
              value="upload_official"
              className="space-y-4 mt-4"
            >
              <Card className="border-blue-200 bg-blue-50/30">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-blue-700" />

                    <CardTitle className="text-sm font-bold text-blue-900">
                      Upload Realisasi Produksi Official
                    </CardTitle>
                  </div>

                  <CardDescription className="text-xs text-blue-800">
                    Hanya akun Arianie Fajarwati yang dapat mempublish Realisasi Produksi. Gunakan CSV dari template Dashboard.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={
                        handleDownloadCsvTemplate
                      }
                      className="text-xs font-bold gap-2 bg-white"
                    >
                      <Download className="w-4 h-4" />
                      Download Template CSV
                    </Button>
                  </div>

                  <div className="p-4 bg-white rounded-xl border border-gray-200">
                    <label className="text-xs font-bold text-gray-700 block mb-2">
                      File CSV Realisasi Produksi
                    </label>

                    <Input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={
                        event => {
                          const file =
                            event.target.files?.[0] ||
                            null;

                          setUploadFile(
                            file
                          );

                          setParsedUpload(
                            null
                          );
                        }
                      }
                      className="text-xs bg-white"
                    />

                    <p className="text-[11px] text-gray-500 mt-2">
                      Gunakan 9 kolom sesuai template Dashboard (termasuk Nomor Polis dan Nama Nasabah), lalu Save As CSV. Sistem menerima delimiter titik-koma maupun koma. File UAT lama 7 kolom tetap diterima dan akan dibuatkan Nomor Polis dummy.
                    </p>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      onClick={
                        handleValidateUpload
                      }
                      disabled={
                        !uploadFile ||
                        isValidating
                      }
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold gap-2"
                    >
                      <Upload className="w-4 h-4" />

                      {isValidating
                        ? 'Memvalidasi...'
                        : 'Validasi & Preview'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {parsedUpload && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-[10px] uppercase font-bold text-gray-500">
                          Source Rows
                        </p>

                        <p className="text-lg font-bold">
                          {parsedUpload.sourceRowCount.toLocaleString(
                            'id-ID'
                          )}
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <p className="text-[10px] uppercase font-bold text-gray-500">
                          Valid
                        </p>

                        <p className="text-lg font-bold text-emerald-700">
                          {parsedUpload.validRecords.length.toLocaleString(
                            'id-ID'
                          )}
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <p className="text-[10px] uppercase font-bold text-gray-500">
                          Ignored
                        </p>

                        <p className="text-lg font-bold text-amber-700">
                          {parsedUpload.ignoredRowCount.toLocaleString(
                            'id-ID'
                          )}
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <p className="text-[10px] uppercase font-bold text-gray-500">
                          Warning
                        </p>

                        <p className="text-lg font-bold text-amber-700">
                          {parsedUpload.warningRowCount.toLocaleString(
                            'id-ID'
                          )}
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <p className="text-[10px] uppercase font-bold text-gray-500">
                          Error
                        </p>

                        <p className="text-lg font-bold text-rose-700">
                          {parsedUpload.errorRowCount.toLocaleString(
                            'id-ID'
                          )}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-[10px] uppercase font-bold text-gray-500">
                          Total Preview
                        </p>

                        <p className="text-base font-bold">
                          {formatRupiah(
                            uploadTotal
                          )}
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <p className="text-[10px] uppercase font-bold text-gray-500">
                          New Business
                        </p>

                        <p className="text-base font-bold">
                          {formatRupiah(
                            uploadNB
                          )}
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <p className="text-[10px] uppercase font-bold text-gray-500">
                          Renewal
                        </p>

                        <p className="text-base font-bold">
                          {formatRupiah(
                            uploadRN
                          )}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="border-gray-200">
                    <CardHeader>
                      <CardTitle className="text-sm font-bold">
                        Preview Publish
                      </CardTitle>

                      <CardDescription className="text-xs">
                        Periode terdeteksi:{' '}
                        {uploadPeriodKeys.join(
                          ', '
                        ) ||
                          '-'}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-3">
                      {overlappingPeriodKeys.length >
                        0 && (
                        <div className="p-3 rounded-lg border border-amber-300 bg-amber-50 text-xs text-amber-900 flex gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />

                          <span>
                            Periode{' '}
                            {overlappingPeriodKeys.join(
                              ', '
                            )}{' '}
                            sudah pernah dipublish. Saat Publish, data official periode tersebut akan direplace.
                          </span>
                        </div>
                      )}

                      {parsedUpload.errorRowCount ===
                        0 ? (
                        <div className="p-3 rounded-lg border border-emerald-300 bg-emerald-50 text-xs text-emerald-900 flex gap-2">
                          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />

                          <span>
                            Tidak ada hard error. Warning tidak memblokir publish.
                          </span>
                        </div>
                      ) : (
                        <div className="p-3 rounded-lg border border-rose-300 bg-rose-50 text-xs text-rose-900 flex gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />

                          <span>
                            Masih ada {parsedUpload.errorRowCount} row error. Publish dinonaktifkan.
                          </span>
                        </div>
                      )}

                      {parsedUpload.issues.length >
                        0 && (
                        <div className="max-h-72 overflow-auto border border-gray-200 rounded-lg">
                          <table className="w-full text-xs">
                            <thead className="bg-gray-50 sticky top-0">
                              <tr>
                                <th className="p-2 text-left">
                                  Row
                                </th>

                                <th className="p-2 text-left">
                                  Status
                                </th>

                                <th className="p-2 text-left">
                                  Keterangan
                                </th>
                              </tr>
                            </thead>

                            <tbody className="divide-y divide-gray-100">
                              {parsedUpload.issues.map(
                                (
                                  issue,
                                  index
                                ) => (
                                  <tr
                                    key={`${issue.rowNumber}-${index}`}
                                  >
                                    <td className="p-2 font-mono">
                                      {issue.rowNumber}
                                    </td>

                                    <td className="p-2">
                                      <Badge
                                        variant="outline"
                                        className={
                                          issue.severity ===
                                          'ERROR'
                                            ? 'bg-rose-50 text-rose-700 border-rose-300'
                                            : 'bg-amber-50 text-amber-700 border-amber-300'
                                        }
                                      >
                                        {issue.severity}
                                      </Badge>
                                    </td>

                                    <td className="p-2 text-gray-700">
                                      {issue.message}
                                    </td>
                                  </tr>
                                )
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {parsedUpload.issues.length >=
                        200 && (
                        <p className="text-[11px] text-gray-500">
                          Preview issue dibatasi 200 baris agar halaman tetap ringan.
                        </p>
                      )}

                      <div className="flex justify-end pt-2">
                        <Button
                          type="button"
                          onClick={
                            handlePublishOfficial
                          }
                          disabled={
                            parsedUpload.errorRowCount >
                              0 ||
                            parsedUpload.validRecords.length ===
                              0
                          }
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                        >
                          Publish Realisasi Produksi
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>
          )}

          {/* ===================================================
              LEGACY MAKER-CHECKER / INVOICE UI
              Intentionally left unreachable for backward compatibility.
              The visible Produksi workflow is now:
              Realisasi Official + Upload Realisasi (Arianie).
          =================================================== */}
          <TabsContent
            value="posted"
            className="space-y-4 mt-4"
          >
            <Card className="border-gray-200">
              <CardHeader>
                <CardTitle className="text-sm font-bold">
                  Daftar Transaksi Invoice POSTED
                </CardTitle>

                <CardDescription className="text-xs">
                  Workflow pencatatan Polis/Invoice Core. Angka dashboard Realisasi Official berasal dari upload snapshot CSV.
                </CardDescription>
              </CardHeader>

              <CardContent>
                {productions.filter(
                  production =>
                    production.status ===
                    'POSTED'
                ).length ===
                0 ? (
                  <div className="p-12 text-center text-xs text-gray-400">
                    Belum ada transaksi invoice ter-POSTED.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 border-b border-gray-200 uppercase text-[10px] text-gray-600">
                        <tr>
                          <th className="p-3">
                            ID Transaksi
                          </th>

                          <th className="p-3">
                            Nasabah
                          </th>

                          <th className="p-3">
                            No. Polis Core
                          </th>

                          <th className="p-3">
                            No. Invoice Core
                          </th>

                          <th className="p-3">
                            Tgl Invoice
                          </th>

                          <th className="p-3">
                            Nominal Invoice
                          </th>

                          <th className="p-3">
                            Maker
                          </th>

                          <th className="p-3">
                            Checker
                          </th>

                          <th className="p-3">
                            Status
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-gray-100">
                        {productions
                          .filter(
                            production =>
                              production.status ===
                              'POSTED'
                          )
                          .map(
                            production => (
                              <tr
                                key={
                                  production.id
                                }
                                className="hover:bg-gray-50"
                              >
                                <td className="p-3 font-mono font-bold text-blue-700">
                                  {
                                    production.id
                                  }
                                </td>

                                <td className="p-3 font-semibold text-gray-900">
                                  {
                                    production.customerName
                                  }
                                </td>

                                <td className="p-3 font-mono text-gray-700">
                                  {
                                    production.corePolicyNumber
                                  }
                                </td>

                                <td className="p-3 font-mono text-gray-700">
                                  {
                                    production.coreInvoiceNumber
                                  }
                                </td>

                                <td className="p-3 text-gray-600">
                                  {formatDate(
                                    production.invoiceDate
                                  )}
                                </td>

                                <td className="p-3 font-bold text-emerald-700">
                                  {formatRupiah(
                                    production.invoiceAmount
                                  )}
                                </td>

                                <td className="p-3 text-gray-600">
                                  {
                                    production.makerUserName
                                  }
                                </td>

                                <td className="p-3 text-gray-600">
                                  {
                                    production.checkerUserName
                                  }
                                </td>

                                <td className="p-3">
                                  <StatusBadge
                                    status={
                                      production.status
                                    }
                                  />
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

          <TabsContent
            value="pending_invoice"
            className="space-y-4 mt-4"
          >
            <Card className="border-gray-200">
              <CardHeader>
                <CardTitle className="text-sm font-bold">
                  Pipeline WIN Belum Diterbitkan Invoice
                </CardTitle>

                <CardDescription className="text-xs">
                  Proses Marketing Support meng-input nomor Polis dan Invoice resmi hasil penerbitan PertaLife Core System.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {winPipelines.length ===
                0 ? (
                  <div className="p-12 text-center text-xs text-gray-400">
                    Tidak ada Pipeline WIN pending invoice.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {winPipelines.map(
                      pipeline => (
                        <div
                          key={
                            pipeline.id
                          }
                          className="p-4 rounded-xl border border-gray-200 bg-white flex items-center justify-between"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-blue-700">
                                {
                                  pipeline.id
                                }
                              </span>

                              <span className="text-xs font-bold text-gray-900">
                                {
                                  pipeline.customerName
                                }
                              </span>
                            </div>

                            <p className="text-xs text-gray-600 mt-1">
                              Produk:{' '}
                              {
                                pipeline.productName
                              }{' '}
                              | Value WIN:{' '}
                              {formatRupiah(
                                pipeline.winningQuotationAmount ||
                                  pipeline.currentCommercialValue
                              )}
                            </p>
                          </div>

                          {isMS && (
                            <Button
                              size="sm"
                              onClick={() =>
                                setSelectedWinPipeline(
                                  pipeline
                                )
                              }
                              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Input Polis & Invoice Core
                            </Button>
                          )}
                        </div>
                      )
                    )}
                  </div>
                )}

                {selectedWinPipeline && (
                  <Card className="border-blue-200 bg-blue-50/50 mt-4 p-4">
                    <CardHeader className="p-0 pb-3">
                      <CardTitle className="text-sm font-bold text-blue-900">
                        Input Data Invoice Core:{' '}
                        {
                          selectedWinPipeline.customerName
                        }
                      </CardTitle>
                    </CardHeader>

                    <CardContent className="p-0 space-y-3">
                      <form
                        onSubmit={
                          handleRecordInvoice
                        }
                        className="space-y-3"
                      >
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-semibold text-gray-700 block mb-1">
                              Nomor Polis Core System *
                            </label>

                            <Input
                              placeholder="POL/2026/008811 atau kosongkan jika belum ada"
                              value={
                                corePolicyNumber
                              }
                              onChange={
                                event =>
                                  setCorePolicyNumber(
                                    event.target.value
                                  )
                              }
                              className="text-xs bg-white"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-semibold text-gray-700 block mb-1">
                              Nomor Invoice / Nota Tagihan Core *
                            </label>

                            <Input
                              placeholder="INV/2026/05/00112"
                              value={
                                coreInvoiceNumber
                              }
                              onChange={
                                event =>
                                  setCoreInvoiceNumber(
                                    event.target.value
                                  )
                              }
                              className="text-xs bg-white"
                              required
                            />
                          </div>

                          <div>
                            <label className="text-xs font-semibold text-gray-700 block mb-1">
                              Tanggal Invoice *
                            </label>

                            <Input
                              type="date"
                              value={
                                invoiceDate
                              }
                              onChange={
                                event =>
                                  setInvoiceDate(
                                    event.target.value
                                  )
                              }
                              className="text-xs bg-white"
                              required
                            />
                          </div>

                          <div>
                            <label className="text-xs font-semibold text-gray-700 block mb-1">
                              Nominal Tagihan (Rp) *
                            </label>

                            <Input
                              type="text"
                              inputMode="numeric"
                              placeholder="Rp5.000.000.000"
                              value={
                                formatRupiahInput(
                                  invoiceAmount
                                )
                              }
                              onChange={
                                event =>
                                  setInvoiceAmount(
                                    sanitizeRupiahInput(
                                      event.target.value
                                    )
                                  )
                              }
                              className="bg-white font-mono text-xs"
                              required
                            />
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setSelectedWinPipeline(
                                null
                              )
                            }
                            className="text-xs"
                          >
                            Batal
                          </Button>

                          <Button
                            type="submit"
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
                          >
                            Simpan & Submit Checker
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent
            value="maker_checker"
            className="space-y-4 mt-4"
          >
            <Card className="border-gray-200">
              <CardHeader>
                <CardTitle className="text-sm font-bold">
                  Antrean Verifikasi Checker Marketing Support
                </CardTitle>

                <CardDescription className="text-xs">
                  Prinsip 4-Eyes: User yang membuat rekaman invoice tidak diperkenankan memverifikasi transaksinya sendiri.
                </CardDescription>
              </CardHeader>

              <CardContent>
                {productions.filter(
                  production =>
                    production.status ===
                    'Pending Checker'
                ).length ===
                0 ? (
                  <div className="p-12 text-center text-xs text-gray-400">
                    Tidak ada transaksi invoice pending verifikasi Checker.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 border-b border-gray-200 uppercase text-[10px] text-gray-600">
                        <tr>
                          <th className="p-3">
                            ID Transaksi
                          </th>

                          <th className="p-3">
                            Nasabah
                          </th>

                          <th className="p-3">
                            No. Invoice Core
                          </th>

                          <th className="p-3">
                            Nominal
                          </th>

                          <th className="p-3">
                            Maker User
                          </th>

                          <th className="p-3 text-right">
                            Aksi Checker
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-gray-100">
                        {productions
                          .filter(
                            production =>
                              production.status ===
                              'Pending Checker'
                          )
                          .map(
                            production => (
                              <tr
                                key={
                                  production.id
                                }
                                className="hover:bg-gray-50"
                              >
                                <td className="p-3 font-mono font-bold text-blue-700">
                                  {
                                    production.id
                                  }
                                </td>

                                <td className="p-3 font-semibold text-gray-900">
                                  {
                                    production.customerName
                                  }
                                </td>

                                <td className="p-3 font-mono text-gray-700">
                                  {
                                    production.coreInvoiceNumber
                                  }
                                </td>

                                <td className="p-3 font-bold text-gray-900">
                                  {formatRupiah(
                                    production.invoiceAmount
                                  )}
                                </td>

                                <td className="p-3 text-gray-600">
                                  {
                                    production.makerUserName
                                  }
                                </td>

                                <td className="p-3 text-right">
                                  {isMS && (
                                    <Button
                                      size="sm"
                                      onClick={() =>
                                        handleCheckerApprove(
                                          production
                                        )
                                      }
                                      className="h-7 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1"
                                    >
                                      <ShieldCheck className="w-3.5 h-3.5" />
                                      Approve POSTED
                                    </Button>
                                  )}
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
    </AppLayout>
  );
};

export default ProduksiPage;
