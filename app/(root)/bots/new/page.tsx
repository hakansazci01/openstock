import { getSession } from '@/lib/better-auth/auth';
import { redirect } from 'next/navigation';
import NewBotForm from '@/components/bots/NewBotForm';

export const dynamic = 'force-dynamic';

export default async function NewBotPage() {
    const session = await getSession();
    if (!session?.user) redirect('/sign-in');

    return (
        <div className="mx-auto w-full max-w-6xl">
            <NewBotForm />
        </div>
    );
}
