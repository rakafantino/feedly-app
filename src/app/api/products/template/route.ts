import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Membuat header untuk template CSV
    const headers = [
      "name",
      "product_code", // SKU
      "description",
      "category",
      "price",
      "stock",
      "unit",
      "barcode",
      "supplier_name",
      "supplier_code",
      "threshold"
    ];

    // Membuat contoh data yang lebih jelas
    const exampleData = [
      [
        "Pakan Ayam Premium",
        "PAK-AYM-001",
        "Pakan berkualitas tinggi untuk ayam broiler",
        "Unggas",
        "75000",
        "50",
        "kg",
        "8991234567890",
        "Supplier Pakan Unggas",
        "SUP-001",
        "10"
      ],
      [
        "Pakan Sapi Perah",
        "PAK-SP-001",
        "Pakan untuk sapi perah dengan nutrisi lengkap",
        "Ternak",
        "120000",
        "30",
        "kg",
        "8991234567891",
        "Supplier Pakan Ternak",
        "SUP-002",
        "5"
      ],
      [
        "Vitamin Ternak",
        "VIT-TRN-001",
        "Suplemen vitamin untuk kesehatan ternak",
        "Suplemen",
        "85000",
        "25",
        "botol",
        "8991234567892",
        "Supplier Suplemen",
        "SUP-003",
        "8"
      ],
      [
        "Obat Cacing Unggas",
        "OBT-CCG-001",
        "Obat anti parasit untuk unggas",
        "Obat",
        "45000",
        "40",
        "sachet",
        "8991234567893",
        "Supplier Obat Ternak",
        "SUP-004",
        "15"
      ]
    ];

    // Menambahkan komentar pada baris pertama untuk petunjuk
    const comment = "# CATATAN: name, price, stock, dan unit adalah wajib diisi. Pastikan barcode unik dan tidak duplikat.";

    // Mengubah data menjadi format CSV
    const csvRows = [
      comment,
      headers.join(','),
      ...exampleData.map(row =>
        row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(',')
      )
    ];

    const csvContent = csvRows.join('\n');

    // Return CSV file
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="product-template.csv"',
      },
    });
  } catch (error) {
    console.error("Error generating template:", error);
    return NextResponse.json(
      { error: "Failed to generate template" },
      { status: 500 }
    );
  }
} 