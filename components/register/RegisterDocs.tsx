// Document upload step
'use client';
import React, { useRef, useState } from 'react';
import { storage } from '../../lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import toast from 'react-hot-toast';

interface RegisterDocsProps {
  formData: any;
  errors: any;
  setFormData: (data: any) => void;
}

export default function RegisterDocs({ formData, errors, setFormData }: RegisterDocsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileURL, setFileURL] = useState(formData.documentURL || '');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const storageRef = ref(storage, `documents/${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);
    uploadTask.on('state_changed',
      (snapshot) => {
        const pct = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setProgress(pct);
      },
      (error) => {
        toast.error('Erro ao enviar documento');
        setUploading(false);
      },
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        setFileURL(url);
        setFormData({ ...formData, documentURL: url });
        toast.success('Documento enviado com sucesso!');
        setUploading(false);
      }
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-8 animate-fade-in flex flex-col gap-6">
      <h2 className="text-2xl font-bold text-center mb-2">Upload de Documentos</h2>
      <div className="flex flex-col gap-4">
        <label className="font-medium mb-2">{formData.accountType === 'pf' ? 'Documento CPF' : 'Documento Empresa'}</label>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/*"
          className="file-input mb-2"
          onChange={handleFileChange}
          disabled={uploading}
        />
        {uploading && (
          <div className="w-full bg-gray-200 rounded h-2 mt-2">
            <div className="bg-blue-600 h-2 rounded" style={{ width: `${progress}%` }} />
          </div>
        )}
        {fileURL && (
          <div className="mt-4">
            <a href={fileURL} target="_blank" rel="noopener noreferrer" className="text-primary-foreground underline">Ver documento enviado</a>
          </div>
        )}
      </div>
    </div>
  );
}
