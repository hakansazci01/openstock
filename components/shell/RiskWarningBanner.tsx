'use client';

import { useEffect, useState } from 'react';
import { ShieldAlert, Info } from 'lucide-react';

export function RiskWarningBanner({ dismissible = true }: { dismissible?: boolean }) {
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        // LocalStorage'da dismissed durumu varsa tekrar gösterme
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('openstock-risk-warning-dismissed');
            if (stored === 'true') setDismissed(true);
        }
    }, []);

    const handleDismiss = () => {
        setDismissed(true);
        if (typeof window !== 'undefined') {
            localStorage.setItem('openstock-risk-warning-dismissed', 'true');
        }
    };

    if (dismissed) return null;

    return (
        <div
            className="fixed top-0 left-0 right-0 z-50 bg-red-50 border-b border-red-200"
            role="alert"
            aria-live="polite"
        >
            <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                        <div className="flex items-start gap-3">
                            <ShieldAlert className="w-5 h-5 text-red-600 flex-shrink-0" />
                            <div>
                                <h3 className="text-sm font-semibold text-red-900">
                                    ⚠️ GERÇEK PARA RİSKİ
                                </h3>
                                <p className="text-sm text-red-700 mt-1">
                                    Bu uygulama GERÇEK PARA ile işlem yapmak için tasarlanmıştır.
                                    Tüm finansal risk size aittir. OpenStock geliştiricisi,
                                    finansal kayıtlardan sorumlu tutulamaz.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3 sm:mt-0 sm:ml-4 text-xs text-red-600">
                            <Info className="w-3 h-3" />
                            <span>Yatırım kararlarınızı kendi sorumluluğunuzda alın.</span>
                        </div>
                    </div>
                    {dismissible && (
                        <button
                            type="button"
                            onClick={handleDismiss}
                            className="inline-flex items-center rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1"
                            aria-label="Uyarıyı kapat"
                        >
                            <span className="sr-only">Kapat</span>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}