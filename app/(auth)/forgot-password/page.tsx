'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import InputField from '@/components/forms/InputField';
import FooterLink from '@/components/forms/FooterLink';
import OpenStockBranding from '@/components/OpenStockBranding';
import { requestPasswordResetEmail } from '@/lib/actions/auth.actions';

type ForgotPasswordFormData = {
    email: string;
};

const ForgotPasswordPage = () => {
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<ForgotPasswordFormData>({
        defaultValues: {
            email: '',
        },
        mode: 'onBlur',
    });

    const onSubmit = async (data: ForgotPasswordFormData) => {
        try {
            const result = await requestPasswordResetEmail(data);

            if (result.success) {
                toast.success('Bu e-posta için bir hesap varsa, sıfırlama bağlantısı gönderilmiştir.');
                return;
            }

            toast.error('Şifre sıfırlama mevcut değil', {
                description: result.error ?? 'Şifre sıfırlama başlatılamadı.',
            });
        } catch (error) {
            toast.error('Şifre sıfırlama mevcut değil', {
                description: error instanceof Error ? error.message : 'Şifre sıfırlama başlatılamadı.',
            });
        }
    };

    return (
        <>
            <h1 className="form-title">Şifrenizi mi unuttunuz??</h1>
            <p className="text-sm text-gray-400 mb-6">
                Enter your email address and we&apos;ll send you a password reset link.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <InputField
                    name="email"
                    label="Email"
                    placeholder="ornek@ornek.com"
                    register={register}
                    error={errors.email}
                    validation={{
                        required: 'Email is required',
                        pattern: {
                            value: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
                            message: 'Lütfen geçerli bir e-posta adresi girin',
                        },
                    }}
                />

                <Button type="submit" disabled={isSubmitting} className="yellow-btn w-full mt-5">
                    {isSubmitting ? 'Sıfırlama bağlantısı gönderiliyor' : 'Sıfırlama bağlantısı gönder'}
                </Button>

                <FooterLink text="Hatırladınız mı??" linkText="Sign in" href="/sign-in" />
                <OpenStockBranding outerClassName="mt-10 flex justify-center" />
            </form>
        </>
    );
};

export default ForgotPasswordPage;

