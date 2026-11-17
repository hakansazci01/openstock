import { getSession } from "@/lib/better-auth/auth";
import { redirect } from "next/navigation";
import AdminTabs from "@/components/admin/AdminTabs";

const AdminLayout = async ({ children }: { children: React.ReactNode }) => {
    const session = await getSession();

    if (!session?.user) redirect('/sign-in');

    const user = session.user as { role?: string };
    if (user.role !== 'admin') redirect('/dashboard');

    return (
        <div className="flex flex-col gap-4">
            <header className="page-head">
                <div>
                    <h1 className="page-title">Yönetim Paneli</h1>
                    <p className="page-sub">Kullanıcılar, botlar, uyarılar ve sistem yapılandırması</p>
                </div>
            </header>
            <AdminTabs />
            {children}
        </div>
    );
};

export default AdminLayout;
