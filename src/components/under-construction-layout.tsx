import { HardHat } from "lucide-react";
import Link from "next/link";
import { Button } from "./ui/button";

interface UnderConstructionLayoutProps {
  title: string;
  description?: string;
  showHomeButton?: boolean;
  estimatedCompletion?: string;
}

export function UnderConstructionLayout({
  title,
  description = "Fitur ini sedang dalam pengembangan. Silakan kembali lagi nanti.",
  showHomeButton = true,
  estimatedCompletion,
}: UnderConstructionLayoutProps) {
  return (
    <div className="min-h-[500px] w-full flex flex-col items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <div className="mx-auto w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center mb-4">
          <HardHat className="w-8 h-8 text-yellow-600" />
        </div>
        
        <h2 className="text-2xl font-bold">{title}</h2>
        <p className="text-muted-foreground">{description}</p>
        
        {estimatedCompletion && (
          <p className="text-sm">
            <span className="text-muted-foreground">Estimasi penyelesaian:</span>{" "}
            <span className="font-medium">{estimatedCompletion}</span>
          </p>
        )}
        
        {showHomeButton && (
          <div className="pt-4">
            <Button asChild variant="outline">
              <Link href="/">Kembali ke Beranda</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
} 