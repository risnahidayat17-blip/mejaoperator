/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface State {
  error: Error | null;
}

/** Mencegah layar putih total: tampilkan pesan dan tombol muat ulang bila ada error tak terduga. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Aplikasi error:', error, info.componentStack);
  }

  render(): React.ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#F8FAF9]">
        <div className="max-w-md w-full bg-white border border-[#D3DDD9] rounded-xl p-6 text-center space-y-3 shadow-sm">
          <h1 className="text-lg font-bold text-[#13262A]">Terjadi kendala pada tampilan</h1>
          <p className="text-sm text-[#566A6E]">
            Data Anda aman. Silakan muat ulang halaman. Jika masih berulang, catat langkah yang dilakukan dan hubungi
            operator.
          </p>
          <pre className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded p-2 text-left overflow-auto max-h-24">
            {this.state.error.message}
          </pre>
          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="px-4 py-2 border border-[#D3DDD9] rounded-lg text-sm text-[#566A6E] cursor-pointer"
            >
              Coba lagi
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-[#0B6B58] text-white rounded-lg text-sm font-semibold cursor-pointer"
            >
              Muat ulang
            </button>
          </div>
        </div>
      </div>
    );
  }
}
