"use client";

import { useEffect, useState } from "react";
// USE formatRupiah instead of formatCurrency
import { formatRupiah } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export default function PriceMovementsPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("ALL");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/price-movements?priceType=${typeFilter}&limit=100`)
      .then(res => res.json())
      .then(data => {
        if (data.history) setHistory(data.history);
        setLoading(false);
      });
  }, [typeFilter]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Laporan Pergerakan Harga</h1>
      
      <div className="mb-4">
        <label className="mr-2 font-medium">Filter Tipe:</label>
        <select 
          className="border rounded p-2"
          value={typeFilter} 
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="ALL">Semua</option>
          <option value="PURCHASE">Harga Beli (Modal)</option>
          <option value="SELLING">Harga Jual</option>
        </select>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded shadow">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3 border-b">Waktu</th>
                <th className="p-3 border-b">Produk</th>
                <th className="p-3 border-b">Tipe</th>
                <th className="p-3 border-b">Harga Lama</th>
                <th className="p-3 border-b">Harga Baru</th>
                <th className="p-3 border-b">Selisih</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr><td colSpan={6} className="p-4 text-center">Tidak ada pergerakan harga.</td></tr>
              ) : (
                history.map(item => {
                  const isIncrease = item.changeAmount > 0;
                  const textColor = isIncrease ? "text-red-600" : "text-green-600";
                  return (
                    <tr key={item.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">{new Date(item.createdAt).toLocaleString()}</td>
                      <td className="p-3 font-medium">{item.product.name}</td>
                      <td className="p-3">
                        <Badge variant={item.priceType === 'PURCHASE' ? 'outline' : 'default'}>
                          {item.priceType === 'PURCHASE' ? 'Beli' : 'Jual'}
                        </Badge>
                      </td>
                      <td className="p-3">{formatRupiah(item.oldPrice)}</td>
                      <td className="p-3">{formatRupiah(item.newPrice)}</td>
                      <td className={`p-3 font-medium ${textColor}`}>
                        {isIncrease ? "+" : ""}{formatRupiah(item.changeAmount)} ({isIncrease ? "+" : ""}{item.changePercentage}%)
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
