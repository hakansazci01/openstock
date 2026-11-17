'use client';

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

import FooterLink from '@/components/forms/FooterLink';
import InputField from '@/components/forms/InputField';
import PasswordRequirements from '@/components/forms/PasswordRequirements';
import OpenStockBranding from '@/components/OpenStockBranding';
import { Button } from '@/components/ui/button';
import { resetPasswordWithToken } from '@/lib/actions/auth.actions';
import { PASSWORD_VALIDATION } from '@/lib/constants';

type ResetPasswordFormData = {
    newPassword: string;
    confirmPassword: string;
};

const ResetPasswordForm = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token') ?? '';
    const error = searchParams.get('error');

    const {
        register,
        watch,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<ResetPasswordFormData>({
        defaultValues: {
            newPassword: '',
            confirmPassword: '',
        },
        mode: 'onBlur',
    });

    const newPassword = watch('newPassword');

    useEffect(() => {
        if (error === 'INVALID_TOKEN') {
            toast.error('Sıfırlama bağlantısı geçersiz veya süresi dolmuş.');
        }
    }, [error]);

    const onSubmit = async (data: ResetPasswordFormData) => {
        if (!token) {
            toast.error('Sıfırlama bağlantısı geçersiz veya süresi dolmuş.');
            return;
        }

        try {
            const result = await resetPasswordWithToken({
                token,
                newPassword: data.newPassword,
            });

            if (result.success) {
                toast.success('Şifre güncellendi. Şimdi giriş yapabilirsiniz.');
                router.push('/sign-in');
                return;
            }

            toast.error('Şifre sıfırlama başarısız', {
                description: result.error ?? 'Şifrenizi sıfırlayamıyoruz.',
            });
        } catch (error) {
            toast.error('Şifre sıfırlama başarısız', {
                description: error instanceof Error ? error.message : 'Şifrenizi sıfırlayamıyoruz.',
            });
        }
    };

    return (
        <>
            <h1 className="form-title">Yeni bir şifre seçin</h1>
            <p className="text-sm text-gray-400 mb-6">
                Hesabınız için yeni bir şifre girin.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <InputField
                    name="newPassword"
                    label="Yeni şifre"
                    placeholder="Enter a Yeni şifre"
                    type="password"
                    register={register}
                    error={errors.newPassword}
                    validation={PASSWORD_VALIDATION}
                />
                <PasswordRequirements password={newPassword ?? ''} />

                <InputField
                    name="confirmPassword"
                    label="Şifreyi onayla"
                    placeholder="Confirm your Yeni şifre"
                    type="password"
                    register={register}
                    error={errors.confirmPassword}
                    validation={{
                        required: 'Please confirm your Yeni şifre',
                        validate: (value: string) =>
                            value === newPassword || 'Şifreler eşleşmiyor',
                    }}
                />

                <Button type="submit" disabled={isSubmitting} className="yellow-btn w-full mt-5">
                    {isSubmitting ? 'Şifre sıfırlanıyor' : 'Şifreyi sıfırla'}
                </Button>

                <FooterLink text="Yeni bir bağlantıya mı ihtiyacınız var??" linkText="Başka bir tane talep edin" href="/forgot-password" />
                <OpenStockBranding outerClassName="mt-10 flex justify-center" />
            </form>
        </>
    );
};

export default ResetPasswordForm;

