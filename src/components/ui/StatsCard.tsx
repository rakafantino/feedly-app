// StatsCard.tsx
// Reusable stats summary card component

"use client";

import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StatsCardProps {
  title?: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  iconColor?: string;
  trend?: {
    value: number;
    isPositive: boolean;
    label?: string;
  };
  className?: string;
  variant?: "default" | "highlight" | "compact" | "dashboard";
}

/**
 * StatsCard - Reusable component for summary statistics
 * 
 * Usage Examples:
 * 
 * // Basic usage
 * <StatsCard
 *   title="Total Sales"
 *   value="Rp 1,000,000"
 *   subtitle="Today"
 *   icon={<DollarIcon />}
 * />
 * 
 * // With trend
 * <StatsCard
 *   value="150"
 *   subtitle="Products sold"
 *   trend={{ value: 12.5, isPositive: true }}
 * />
 * 
 * // Highlight variant (for important metrics)
 * <StatsCard
 *   value="24"
 *   subtitle="Low stock items"
 *   variant="highlight"
 *   icon={<AlertIcon className="text-red-500" />}
 * />
 * 
 * // Dashboard variant (CardHeader with icon, CardContent with value)
 * <StatsCard
 *   title="Total Penjualan"
 *   value="Rp 1,000,000"
 *   subtitle="Dari kemarin"
 *   icon={<DollarSVG />}
 *   variant="dashboard"
 * />
 */
export function StatsCard({
  title,
  value,
  subtitle,
  icon,
  iconColor = "text-muted-foreground",
  trend,
  className,
  variant = "default",
}: StatsCardProps) {
  // Dashboard variant (matches Dashboard page style)
  if (variant === "dashboard") {
    return (
      <Card className={className}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {icon && (
            <span className={iconColor || "text-muted-foreground"}>
              {icon}
            </span>
          )}
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{value}</div>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
          {trend && (
            <p className={`text-xs mt-1 ${trend.isPositive ? "text-green-600" : "text-red-600"}`}>
              {trend.isPositive ? "+" : ""}{trend.value}%
              {trend.label && ` ${trend.label}`}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (variant === "highlight") {
    return (
      <Card className={`bg-primary/5 border-primary/20 ${className || ""}`}>
        <CardContent className="pt-6">
          {icon && (
            <div className="flex items-center gap-2 mb-2">
              {icon}
            </div>
          )}
          {title && (
            <span className="text-sm text-muted-foreground">{title}</span>
          )}
          <div className="text-2xl sm:text-3xl font-bold mt-1">
            {value}
          </div>
          {subtitle && (
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
              {subtitle}
            </p>
          )}
          {trend && (
            <p className={`text-xs mt-1 ${trend.isPositive ? "text-green-600" : "text-red-600"}`}>
              {trend.isPositive ? "+" : ""}{trend.value}% {trend.label || "vs yesterday"}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (variant === "compact") {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            {icon && <span className={iconColor}>{icon}</span>}
            {title && <span className="text-sm text-muted-foreground">{title}</span>}
          </div>
          <div className="text-xl sm:text-2xl font-bold mt-2 truncate">
            {value}
          </div>
          {subtitle && (
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
              {subtitle}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // Default variant (basic card)
  return (
    <Card className={className}>
      <CardContent className="pt-6">
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">
            {subtitle}
          </p>
        )}
        {trend && (
          <p className={`text-xs mt-1 ${trend.isPositive ? "text-green-600" : "text-red-600"}`}>
            {trend.isPositive ? "+" : ""}{trend.value}%
            {trend.label && ` ${trend.label}`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

