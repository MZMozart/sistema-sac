// Modern stepper component for onboarding
'use client';
import React from 'react';

interface StepperProps {
  steps: string[];
  current: number;
}

export default function Stepper({ steps, current }: StepperProps) {
  return (
    <div className="flex items-center gap-4 mb-6">
      {steps.map((step, idx) => (
        <div key={step} className="flex items-center">
          <div className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-white ${idx === current ? 'bg-blue-600' : 'bg-gray-300'}`}>{idx + 1}</div>
          <div className={`ml-2 text-sm font-medium ${idx === current ? 'text-blue-600' : 'text-gray-500'}`}>{step}</div>
          {idx < steps.length - 1 && <div className="mx-2 w-8 h-1 bg-gray-200 rounded" />}
        </div>
      ))}
    </div>
  );
}
