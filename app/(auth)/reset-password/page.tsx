import { Suspense } from 'react';

import ResetPasswordForm from './ResetPasswordForm';

const ResetPasswordPage = () => {
    return (
        <Suspense fallback={<div className="text-sm text-gray-400">Sıfırlama formu yükleniyor...</div>}>
            <ResetPasswordForm />
        </Suspense>
    );
};

export default ResetPasswordPage;

