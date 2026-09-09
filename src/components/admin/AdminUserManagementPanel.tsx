import React, { useState } from 'react';
import { ShieldCheck, UserCog, UserRoundPlus, UserRoundX } from 'lucide-react';
import { adminApi, ManagedRole } from '../../api/admin';

interface Props {
  canManageUsers: boolean;
  isAr: boolean;
  addToast: (message: string, messageAr: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const AdminUserManagementPanel: React.FC<Props> = ({ canManageUsers, isAr, addToast }) => {
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<ManagedRole>('READER');
  const [busy, setBusy] = useState<'assign' | 'revoke' | null>(null);

  const validate = () => {
    if (!uuidPattern.test(userId.trim())) {
      addToast('Enter a valid Supabase user UUID.', 'أدخل معرّف UUID صالحاً لمستخدم Supabase.', 'warning');
      return false;
    }
    if (!canManageUsers) {
      addToast('Your account does not have permission to manage roles.', 'لا يملك حسابك صلاحية إدارة الأدوار.', 'error');
      return false;
    }
    return true;
  };

  const assign = async () => {
    if (!validate()) return;
    setBusy('assign');
    try {
      const result = (await adminApi.assignRole(userId.trim(), role)).data;
      addToast(`${result.role} was assigned by the server.`, `تم إسناد دور ${result.role} من الخادم.`, 'success');
    } catch {
      addToast('The role could not be assigned. The server may have blocked the change.', 'تعذر إسناد الدور؛ ربما حظر الخادم هذا التغيير.', 'error');
    } finally { setBusy(null); }
  };

  const revoke = async () => {
    if (!validate()) return;
    setBusy('revoke');
    try {
      await adminApi.revokeRole(userId.trim(), role);
      addToast(`${role} was removed by the server.`, `تمت إزالة دور ${role} من الخادم.`, 'success');
    } catch {
      addToast('The role could not be removed. The server may have blocked the change.', 'تعذر إزالة الدور؛ ربما حظر الخادم هذا التغيير.', 'error');
    } finally { setBusy(null); }
  };

  return (
    <section className="p-6 rounded-3xl bg-[#0B1712] border border-[#173125] space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-xs font-bold text-[#D2BB82]"><UserCog className="w-4 h-4" />{isAr ? 'أدوار المستخدمين وصلاحياتهم' : 'User roles & permissions'}</div><p className="mt-1 max-w-2xl text-xs leading-relaxed text-[#89977C]">{isAr ? 'يدير هذا النموذج الأدوار الدائمة من الخادم. يحصل المدير على المعرّف من صفحة مستخدمي Supabase؛ لا تمنح الواجهة صلاحيات من المتصفح.' : 'This form manages durable roles on the server. An administrator obtains the ID from Supabase Users; the browser never grants permissions by itself.'}</p></div><div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#687B61]/60 bg-[#10231A] text-[10px] text-[#B5D3A1]"><ShieldCheck className="w-3.5 h-3.5" />{isAr ? 'تحقق خادمي إلزامي' : 'Server verification required'}</div></div>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-3"><label className="text-[11px] font-semibold text-[#89977C]">{isAr ? 'معرّف مستخدم Supabase (UUID)' : 'Supabase user ID (UUID)'}<input value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" disabled={!canManageUsers || !!busy} className="mt-1.5 w-full bg-[#07110D] border border-[#173125] rounded-xl px-3 py-2.5 text-xs font-mono text-[#E8E0CF]" /></label><label className="text-[11px] font-semibold text-[#89977C]">{isAr ? 'الدور' : 'Role'}<select value={role} onChange={(event) => setRole(event.target.value as ManagedRole)} disabled={!canManageUsers || !!busy} className="mt-1.5 w-full bg-[#07110D] border border-[#173125] rounded-xl px-3 py-2.5 text-xs text-[#E8E0CF]"><option value="READER">READER</option><option value="MODERATOR">MODERATOR</option><option value="ADMIN">ADMIN</option></select></label></div>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void assign()} disabled={!canManageUsers || !!busy} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#173125] border border-[#687B61] text-xs font-bold text-[#D2BB82] disabled:opacity-40"><UserRoundPlus className="w-4 h-4" />{busy === 'assign' ? (isAr ? 'جارٍ الإسناد…' : 'Assigning…') : (isAr ? 'إسناد الدور' : 'Assign role')}</button><button type="button" onClick={() => void revoke()} disabled={!canManageUsers || !!busy} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1E0F11] border border-[#4A2528] text-xs font-bold text-[#F3D5D7] disabled:opacity-40"><UserRoundX className="w-4 h-4" />{busy === 'revoke' ? (isAr ? 'جارٍ الإزالة…' : 'Removing…') : (isAr ? 'إزالة الدور' : 'Remove role')}</button></div>
      <p className="text-[10px] leading-relaxed text-[#89977C]">{isAr ? 'لا يمكن للمدير رفع صلاحية حسابه أو إزالة دوره الإداري عن نفسه؛ يفرض الخادم هذه القواعد ويحفظ الأثر في سجل التدقيق.' : 'An administrator cannot self-elevate or remove their own ADMIN role; the server enforces these rules and records the operation in the audit trail.'}</p>
    </section>
  );
};
