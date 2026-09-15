import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatRupiah } from '@/utils/formatters';
import type { DirectorateProductionPolicyDetail } from '@/services/directoratePerformanceService';

type ProductRow = {
  name: string;
  amount: number;
  transactions: number;
};

type PolicyRow = {
  policyKey: string;
  policyNumber: string;
  customerName: string;
  amount: number;
  sourceRows: number;
  legacyBackfill: boolean;
};

const formatCount = (value: number) => value.toLocaleString('id-ID');
const normalizeKey = (value: string) => value.trim().replace(/\s+/g, ' ').toUpperCase();

const ProductPolicyDrilldown: React.FC<{
  products: ProductRow[];
  details: DirectorateProductionPolicyDetail[];
  filterKey: string;
}> = ({ products, details, filterKey }) => {
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

  useEffect(() => {
    setExpandedProduct(null);
  }, [filterKey]);

  const detailsByProduct = useMemo(() => {
    const result = new Map<string, PolicyRow[]>();
    const grouped = new Map<string, Map<string, PolicyRow>>();

    details.forEach(row => {
      const productName = row.productName || 'Produk belum terpetakan';
      const productKey = normalizeKey(productName);
      const policyNumber = row.policyNumber.trim();
      const customerName = row.customerName.trim() || 'Pemegang polis belum teridentifikasi';
      const policyKey = normalizeKey(policyNumber) || `CUSTOMER:${normalizeKey(customerName)}`;
      const productPolicies = grouped.get(productKey) || new Map<string, PolicyRow>();
      const previous = productPolicies.get(policyKey);

      if (previous) {
        previous.amount += row.amount;
        previous.sourceRows += row.sourceRows;
        previous.legacyBackfill = previous.legacyBackfill || row.legacyBackfill;
        if (!previous.customerName && customerName) previous.customerName = customerName;
      } else {
        productPolicies.set(policyKey, {
          policyKey,
          policyNumber,
          customerName,
          amount: row.amount,
          sourceRows: row.sourceRows,
          legacyBackfill: row.legacyBackfill,
        });
      }
      grouped.set(productKey, productPolicies);
    });

    grouped.forEach((policies, productKey) => {
      result.set(productKey, [...policies.values()].sort((a, b) =>
        b.amount - a.amount || a.customerName.localeCompare(b.customerName, 'id') || a.policyNumber.localeCompare(b.policyNumber, 'id')
      ));
    });
    return result;
  }, [details]);

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="text-sm">Realisasi per Produk</CardTitle>
        <CardDescription className="text-xs">
          Klik produk untuk melihat pemegang polis. Nomor polis yang berulang ditampilkan satu kali dan nilai realisasinya dijumlahkan.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-xs">
            <thead className="border-b bg-slate-50">
              <tr>
                <th className="p-3">Produk</th>
                <th className="p-3 text-right">Realisasi</th>
                <th className="p-3 text-right">Source Rows</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {products.map(product => {
                const productKey = normalizeKey(product.name);
                const expanded = expandedProduct === product.name;
                const policyRows = detailsByProduct.get(productKey) || [];
                const capturedAmount = policyRows.reduce((sum, row) => sum + row.amount, 0);
                const capturedRows = policyRows.reduce((sum, row) => sum + row.sourceRows, 0);
                const residualAmount = product.amount - capturedAmount;
                const residualRows = product.transactions - capturedRows;
                const hasResidual = residualAmount !== 0 || residualRows !== 0;

                return (
                  <React.Fragment key={product.name}>
                    <tr className="hover:bg-slate-50">
                      <td className="p-3 font-semibold">
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 text-left text-slate-900"
                          onClick={() => setExpandedProduct(expanded ? null : product.name)}
                          aria-expanded={expanded}
                        >
                          {expanded ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" /> : <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />}
                          <span>{product.name}</span>
                        </button>
                      </td>
                      <td className="p-3 text-right font-semibold">{formatRupiah(product.amount)}</td>
                      <td className="p-3 text-right">{formatCount(product.transactions)}</td>
                    </tr>
                    {expanded && (
                      <tr>
                        <td colSpan={3} className="bg-slate-50/70 p-0">
                          <div className="border-y border-slate-200 px-5 py-4">
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="text-xs font-bold text-slate-800">Detail Pemegang Polis</p>
                                <p className="mt-1 text-[11px] text-slate-500">Satu nomor polis = satu baris. Nilai berasal dari penjumlahan seluruh source row yang cocok.</p>
                              </div>
                              <Badge variant="outline" className="bg-white">{formatCount(policyRows.length)} polis teridentifikasi</Badge>
                            </div>
                            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                              <table className="w-full min-w-[560px] text-left text-xs">
                                <thead className="border-b bg-slate-50 text-[11px] text-slate-600">
                                  <tr>
                                    <th className="p-3">Nama Pemegang Polis</th>
                                    <th className="p-3 text-right">Realisasi</th>
                                    <th className="p-3 text-right">Source Rows</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {policyRows.map(row => (
                                    <tr key={row.policyKey}>
                                      <td className="p-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="font-semibold text-slate-900">{row.customerName}</span>
                                          {row.legacyBackfill && <Badge variant="outline" className="text-[9px] font-medium">HISTORIS</Badge>}
                                        </div>
                                        <p className="mt-1 text-[10px] text-slate-500">No. Polis: {row.policyNumber || 'Tidak tersedia'}</p>
                                      </td>
                                      <td className="p-3 text-right font-semibold text-slate-900">{formatRupiah(row.amount)}</td>
                                      <td className="p-3 text-right text-slate-600">{formatCount(row.sourceRows)}</td>
                                    </tr>
                                  ))}
                                  {hasResidual && (
                                    <tr className="bg-amber-50/60">
                                      <td className="p-3">
                                        <p className="font-semibold text-amber-900">Detail historis / scope akses belum tersedia</p>
                                        <p className="mt-1 text-[10px] leading-relaxed text-amber-700">Nilai ini menjaga rekonsiliasi tepat dengan total produk. Detail akan terisi penuh setelah periode terkait dipublish ulang dengan format Realisasi terbaru atau jika hak akses detail mencakup seluruh row.</p>
                                      </td>
                                      <td className="p-3 text-right font-semibold text-amber-900">{formatRupiah(residualAmount)}</td>
                                      <td className="p-3 text-right text-amber-800">{formatCount(residualRows)}</td>
                                    </tr>
                                  )}
                                  {policyRows.length === 0 && !hasResidual && (
                                    <tr><td colSpan={3} className="p-6 text-center text-slate-500">Belum ada detail polis untuk produk ini.</td></tr>
                                  )}
                                </tbody>
                                <tfoot className="border-t bg-slate-50 font-bold text-slate-900">
                                  <tr>
                                    <td className="p-3">TOTAL {product.name}</td>
                                    <td className="p-3 text-right">{formatRupiah(product.amount)}</td>
                                    <td className="p-3 text-right">{formatCount(product.transactions)}</td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {products.length === 0 && (
                <tr><td colSpan={3} className="p-6 text-center text-slate-500">Belum ada realisasi Official untuk pilihan ini.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProductPolicyDrilldown;
