// Modular registration type selector
'use client';
import React from 'react';

interface RegisterTypeProps {
  onSelect: (type: 'pf' | 'pj') => void;
}

export default function RegisterType({ onSelect }: RegisterTypeProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      <h2 className="text-xl font-bold">Selecione o tipo de cadastro</h2>
      <div className="flex gap-4">
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={() => onSelect('pf')}
        >
          Pessoa Física
        </button>
        <button
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          onClick={() => onSelect('pj')}
        >
          Pessoa Jurídica
        </button>
      </div>
    </div>
  );
}
