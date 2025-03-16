'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { format, subMonths } from 'date-fns';
import { id } from 'date-fns/locale';
import { toast } from 'sonner';

// Define the interface for seasonal item
interface SeasonalItem {
  id: string;
  name: string;
  category: string;
  trend: 'up' | 'down' | 'stable';
  percentChange: number;
  currentStock: number;
  averageDemand: number;
}

// Define the interface for seasonal sales data
interface SeasonalSalesData {
  month: string;
  sales: number;
}

const SeasonalAnalysis = () => {
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [seasonalProducts, setSeasonalProducts] = useState<SeasonalItem[]>([]);
  const [historicalData, setHistoricalData] = useState<SeasonalSalesData[]>([]);
  
  // Helper function to render trend icon
  const renderTrendIcon = (trend: string, percent: number) => {
    if (trend === 'up') {
      return (
        <span className="flex items-center text-green-600">
          <TrendingUp className="h-3 w-3 mr-1" />
          +{percent}%
        </span>
      );
    } else if (trend === 'down') {
      return (
        <span className="flex items-center text-red-600">
          <TrendingDown className="h-3 w-3 mr-1" />
          {percent}%
        </span>
      );
    }
    return <span>Stabil</span>;
  };

  // Dummy data generator for seasonal trends
  const fetchSeasonalData = async () => {
    setIsLoading(true);
    try {
      // In a real application, this would be an API call
      const dummyProducts: SeasonalItem[] = [
        {
          id: "1",
          name: "Pakan Ayam Premium",
          category: "Pakan Ternak",
          trend: "up",
          percentChange: 15,
          currentStock: 25,
          averageDemand: 40,
        },
        {
          id: "2",
          name: "Vitamin Unggas",
          category: "Vitamin",
          trend: "up",
          percentChange: 23,
          currentStock: 15,
          averageDemand: 30,
        },
        {
          id: "3",
          name: "Pakan Sapi",
          category: "Pakan Ternak",
          trend: "down",
          percentChange: 8,
          currentStock: 60,
          averageDemand: 45,
        },
      ];

      // Generate dummy historical data
      const historicalMonths = Array.from({ length: 12 }, (_, i) => {
        const date = subMonths(new Date(), i);
        return format(date, 'MMMM yyyy', { locale: id });
      }).reverse();

      const dummyHistoricalData = historicalMonths.map((month) => ({
        month,
        sales: Math.floor(Math.random() * 100) + 50,
      }));

      // Set data
      setSeasonalProducts(dummyProducts);
      setHistoricalData(dummyHistoricalData);
    } catch (error) {
      console.error('Error fetching seasonal data:', error);
      toast.error('Gagal memuat data analisis musiman');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    fetchSeasonalData();

  }, []);

  // Dummy data for upcoming periods that can affect inventory
  const upcomingPeriods = [
    {
      festival: "Musim Panen",
      startDate: "April 2023",
      endDate: "Juni 2023",
      products: ["Pakan Ayam Premium", "Vitamin A", "Probiotik"],
    },
    {
      festival: "Puncak Bertelur",
      startDate: "Mei 2023",
      endDate: "Juli 2023",
      products: ["Vitamin Unggas", "Kalsium Ayam", "Mineral Mix"],
    },
    {
      festival: "Musim Hujan",
      startDate: "Oktober 2023",
      endDate: "Februari 2024",
      products: ["Obat Anti Jamur", "Vitamin C", "Antiseptik Kandang"],
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Analisis Produk Musiman</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            {seasonalProducts.length > 0 ? (
              <div className="space-y-6">
                {/* Products list */}
                <div>
                  <h3 className="text-sm font-medium mb-3">Produk Musiman</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {seasonalProducts.map((item) => (
                      <div
                        key={item.id}
                        className={`p-3 cursor-pointer rounded-md border ${
                          selectedProductId === item.id ? 'border-primary bg-accent/50' : ''
                        }`}
                        onClick={() => setSelectedProductId(item.id)}
                      >
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium leading-none">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{renderTrendIcon(item.trend, item.percentChange)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Historical data */}
                <div>
                  <h3 className="text-sm font-medium mb-3">Data Historis</h3>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={historicalData}
                        margin={{
                          top: 5,
                          right: 30,
                          left: 20,
                          bottom: 5,
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="month"
                          tickFormatter={(str) => {
                            return str.split(' ').slice(0, 2).join(' ');
                          }}
                        />
                        <YAxis />
                        <RechartsTooltip
                          labelFormatter={(value) => {
                            return `Bulan: ${value[0]}`;
                          }}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="sales" stroke="#8884d8" activeDot={{ r: 8 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                {/* Upcoming periods */}
                <div>
                  <h3 className="text-sm font-medium mb-3">Periode Mendatang</h3>
                  <div className="space-y-3">
                    {upcomingPeriods.map((period) => (
                      <div key={period.festival} className="p-3 border rounded-md">
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium leading-none">{period.festival}</p>
                          <p className="text-xs text-muted-foreground">{period.startDate} - {period.endDate}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p>Tidak ada data produk musiman.</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default SeasonalAnalysis;