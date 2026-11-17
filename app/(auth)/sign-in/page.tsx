'use client';

import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import InputField from '@/components/forms/InputField';
import FooterLink from '@/components/forms/FooterLink';
import { signInWithEmail } from "@/lib/actions/auth.actions";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import OpenStockBranding from "@/components/OpenStockBranding";
import SocialAuthButtons from "@/components/forms/SocialAuthButtons";
import React from "react";

const SignIn = () => {
    const router = useRouter()
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<SignInFormData>({
        defaultValues: {
            email: '',
            password: '',
        },
        mode: 'onBlur',
    });

    const onSubmit = async (data: SignInFormData) => {
        try {
            const result = await signInWithEmail(data);
            if (result.success) {
                router.push('/dashboard');
                return;
            }
            toast.error('Giriş başarısız', {
                description: result.error ?? 'Geçersiz e-posta veya şifre.',
            });
        } catch (e) {
            console.error(e);
            toast.error('Giriş başarısız', {
                description: e instanceof Error ? e.message : 'Giriş yapılamadı.'
            })
        }
    }

    return (
        <>
            <h1 className="form-title mb-2">Tekrar hoş geldiniz</h1>
            <p className="mb-8 text-faint">İzleme listenizin ve uyarılarınızın giriş yapın.</p>

            <SocialAuthButtons />

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <InputField
                    name="email"
                    label="Email"
                    placeholder="ornek@ornek.com"
                    register={register}
                    error={errors.email}
                    validation={{
                        required: 'E-posta gereklidir',
                        pattern: {
                            value: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
                            message: 'Lütfen geçerli bir e-posta adresi girin'
                        }
                    }}
                />

                <InputField
                    name="password"
                    label="Password"
                    placeholder="Şifrenizi girin"
                    type="password"
                    register={register}
                    error={errors.password}
                    validation={{ required: 'Şifre gereklidir', minLength: 8 }}
                />

                <div className="flex justify-end">
                    <Link href="/forgot-password" className="footer-link text-sm">
                        Şifrenizi mi unuttunuz?
                    </Link>
                </div>

                <Button type="submit" disabled={isSubmitting} className="yellow-btn w-full mt-5">
                    {isSubmitting ? 'Giriş yapılıyor' : 'Giriş yap'}
                </Button>

                <FooterLink text="Hesabınız yok mu?" linkText="Hesap oluştur" href="/sign-up" />
                <OpenStockBranding outerClassName="mt-10 flex justify-center" />
            </form>
        </>
    );
};
export default SignIn;

