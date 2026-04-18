"use client";

import { useEffect, useState } from "react";
import { formatRupiah } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function PriceHistoryTab({ productId }: { productId: string }) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/products/${productId}/price-history`)
      .then(res => res.json())
      .then(data => {
        if (data.history) setHistory(data.history);
        setLoading(false);
      });
  }, [productId]);

  if (loading) return <div>Loading history...</div>;
  if (history.length === 0) return <div>Belum ada riwayat perubahan harga.</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left border">
        <thead className="bg-muted">
          <tr>
            <th className="p-3 border">Tanggal</th>
            <th className="p-3 border">Tipe</th>
            <th className="p-3 border">Harga Lama</th>
            <th className="p-3 border">Harga Baru</th>
            <th className="p-3 border">Selisih</th>
            <th className="p-3 border">Sumber</th>
          </tr>
        </thead>
        <tbody>
          {history.map(item => {
            const isIncrease = item.changeAmount > 0;
            const textColor = isIncrease ? "text-red-600" : "text-green-600";
            return (
              <tr key={item.id} className="border-b">
                <td className="p-3 border">{new Date(item.createdAt).toLocaleString()}</td>
                <td className="p-3 border">
                  <Badge variant={item.priceType === 'PURCHASE' ? 'outline' : 'default'}>
                    {item.priceType === 'PURCHASE' ? 'Beli (Modal)' : 'Jual'}
                  </Badge>
                </td>
                <td className="p-3 border">{formatRupiah(item.oldPrice)}</td>
                <td className="p-3 border">{formatRupiah(item.newPrice)}</td>
                <td className={`p-3 border font-medium ${textColor}`}>
                  {isIncrease ? "+" : ""}{formatRupiah(item.changeAmount)} ({isIncrease ? "+" : ""}{item.changePercentage}%)
                </td>
                <td className="p-3 border">{item.source}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}