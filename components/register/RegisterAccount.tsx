"use client";
import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Mail, Lock } from "lucide-react";
import { googleProvider, auth } from '../../lib/firebase';
import { signInWithPopup } from 'firebase/auth';
import toast from 'react-hot-toast';


interface RegisterAccountProps {
  formData: any;
  errors: any;
  setFormData: (data: any) => void;
  onGoogleSignup?: () => void;
  onNext?: () => void;
  accountType?: 'pf' | 'pj';
}

export default function RegisterAccount({ formData, errors = {}, setFormData, onGoogleSignup, onNext, accountType }: RegisterAccountProps) {
  const [loading, setLoading] = useState(false);

  const handleGoogleSignup = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      setFormData({
        ...formData,
        email: user.email,
        name: user.displayName,
        googleId: user.uid,
        accountType: accountType || 'pf',
      });
      toast.success('Conta criada com Google!');
      if (onGoogleSignup) onGoogleSignup();
    } catch (err) {
      toast.error('Erro ao autenticar com Google');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        className="w-full h-12 text-base gap-3 border-border hover:bg-secondary btn-press"
        onClick={handleGoogleSignup}
        disabled={loading}
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        {accountType === 'pj' ? 'Cadastrar com Google' : 'Continuar com Google'}
      </Button>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">ou continue com email</span>
        </div>
      </div>

      <form onSubmit={e => { e.preventDefault(); if (onNext) onNext(); }} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={formData.email || ''}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              className="pl-10 h-12 bg-secondary/50 border-border focus-ring"
              autoComplete="email"
              required
            />
          </div>
          {errors.email && <div className="text-red-500 text-xs">{errors.email}</div>}
        </div>
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium">Senha</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="password"
              type="password"
              placeholder="Sua senha"
              value={formData.password || ''}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
              className="pl-10 h-12 bg-secondary/50 border-border focus-ring"
              autoComplete="new-password"
              required
            />
          </div>
          {errors.password && <div className="text-red-500 text-xs">{errors.password}</div>}
        </div>
        <Button type="submit" className="w-full h-12 text-base gap-3 bg-gradient-primary glow btn-press text-primary-foreground" variant="default">Avançar</Button>
      </form>
    </>
  );
}
