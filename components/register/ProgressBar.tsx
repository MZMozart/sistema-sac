"use client";
import React from "react";

export default function ProgressBar({ step, total }: { step: number, total: number }) {
  const percent = Math.round(((step + 1) / total) * 100);
  return (
    <div className="w-full h-2 bg-gray-200 rounded-full mb-6 overflow-hidden">
      <div
        className="h-2 bg-gradient-primary transition-all duration-500"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
