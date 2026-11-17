'use client';

import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import InputField from "@/components/forms/InputField";
import ChoiceChips from "@/components/forms/ChoiceChips";
import PasswordRequirements from "@/components/forms/PasswordRequirements";
import { INVESTMENT_GOALS, PASSWORD_VALIDATION, PREFERRED_INDUSTRIES, RISK_TOLERANCE_OPTIONS } from "@/lib/constants";
import { CountrySelectField } from "@/components/forms/CountrySelectField";
import FooterLink from "@/components/forms/FooterLink";
import { signUpWithEmail } from "@/lib/actions/auth.actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import OpenStockBranding from "@/components/OpenStockBranding";
import SocialAuthButtons from "@/components/forms/SocialAuthButtons";
import React from "react";

const SignUp = () => {
    const router = useRouter()
    const {
        register,
        handleSubmit,
        control,
        watch,
        formState: { errors, isSubmitting },
    } = useForm<SignUpFormData>({
        defaultValues: {
            fullName: '',
            email: '',
            password: '',
            country: 'IN',
            investmentGoals: 'Growth',
            riskTolerance: 'Medium',
            preferredIndustry: 'Technology'
        },
        mode: 'onBlur'
    },);

    const passwordValue = watch('password');

    const onSubmit = async (data: SignUpFormData) => {
        try {
            const result = await signUpWithEmail(data);
            if (result.success) {
                router.push('/dashboard');
                return;
            }
            toast.error('Kayıt başarısız', {
                description: result.error ?? 'We could not Hesabınızı oluşturun.',
            });
        } catch (e) {
            console.error(e);
            toast.error('Kayıt başarısız', {
                description: e instanceof Error ? e.message : 'Hesap oluşturulamadı.'
            })
        }
    }

    return (
        <>
            <h1 className="form-title mb-2">Hesabınızı oluşturun</h1>
            <p className="mb-8 text-faint">Ücretsiz ve açık kaynak. Kart gerekmez.</p>

            <SocialAuthButtons />

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-8">
                <section className="flex flex-col gap-4" aria-label="Account">
                    <InputField
                        name="fullName"
                        label="Full name"
                        placeholder="Adınız"
                        register={register}
                        error={errors.fullName}
                        validation={{ required: 'Ad soyad gereklidir', minLength: 2 }}
                    />
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
                                message: 'Please enter a valid email address'
                            }
                        }}
                    />
                    <div className="flex flex-col gap-2">
                        <InputField
                            name="password"
                            label="Password"
                            placeholder="En az 8 karakter"
                            type="password"
                            register={register}
                            error={errors.password}
                            validation={PASSWORD_VALIDATION}
                        />
                        <PasswordRequirements password={passwordValue ?? ''} />
                    </div>
                </section>

                <section className="flex flex-col gap-5 border-t border-line pt-6" aria-labelledby="Kişiselleştir">
                    <div>
                        <p id="Kişiselleştir" className="kicker text-brand-ink">Kişiselleştir</p>
                        <p className="mt-1 text-[13px] text-faint">Hoş geldin e-postanızı kişiselleştirmek için kullanılır.</p>
                    </div>
                    <CountrySelectField
                        name="country"
                        label="Country"
                        control={control}
                        error={errors.country}
                        required
                    />
                    <ChoiceChips name="investmentGoals" label="Investment goal" options={INVESTMENT_GOALS} control={control} />
                    <ChoiceChips name="riskTolerance" label="Risk tolerance" options={RISK_TOLERANCE_OPTIONS} control={control} />
                    <ChoiceChips name="preferredIndustry" label="Preferred industry" options={PREFERRED_INDUSTRIES} control={control} />
                </section>

                <div className="flex flex-col gap-4">
                    <Button type="submit" disabled={isSubmitting} className="yellow-btn w-full">
                        {isSubmitting ? 'Hesap oluşturuluyor' : 'Hesap oluştur'}
                    </Button>
                    <FooterLink text="Zaten hesabınız var mı?" linkText="Sign in" href="/sign-in" />
                </div>

                <OpenStockBranding outerClassName="flex justify-center" />
            </form>
        </>
    )
}
export default SignUp;

