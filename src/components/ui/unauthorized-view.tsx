
import { ShieldAlert } from "lucide-react";

export function UnauthorizedView() {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center p-4">
      <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
      <h2 className="text-2xl font-bold mb-2">Akses Ditolak</h2>
      <p className="text-muted-foreground">
        Anda tidak memiliki izin untuk mengakses halaman ini.
        <br />Hubungi Manager atau Owner jika ini adalah kesalahan.
      </p>
    </div>
  );
}
