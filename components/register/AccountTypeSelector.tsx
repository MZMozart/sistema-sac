"use client";
import React from "react";
import { Button } from "../ui/button";

export default function AccountTypeSelector({ value, onSelect }: { value: "pf" | "pj" | null, onSelect: (type: "pf" | "pj") => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6">
      <h2 className="text-2xl font-bold mb-4">Selecione o tipo de conta</h2>
      <div className="flex gap-6">
        <Button
          className={`glass-card px-8 py-6 text-lg font-semibold bg-gradient-to-r from-blue-500 to-blue-700 shadow-lg transition-transform duration-300 ${value === "pf" ? "scale-105 ring-2 ring-blue-400" : "hover:scale-105"}`}
          onClick={() => onSelect("pf")}
        >
          Pessoa Física
        </Button>
        <Button
          className={`glass-card px-8 py-6 text-lg font-semibold bg-gradient-to-r from-blue-700 to-blue-500 shadow-lg transition-transform duration-300 ${value === "pj" ? "scale-105 ring-2 ring-blue-400" : "hover:scale-105"}`}
          onClick={() => onSelect("pj")}
        >
          Pessoa Jurídica
        </Button>
      </div>
    </div>
  );
}
