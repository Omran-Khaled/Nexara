import React, { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { AuthenticatedProfile, authConfigured, authMode, localAuth, profileFromUser, supabase } from '../../lib/auth';
import { accountApi, primaryUserRole } from '../../api/account';
import { X, LogIn, UserPlus, LogOut, ShieldCheck, Save, KeyRound } from 'lucide-react';
import { motion } from 'motion/react';
import { AccessibleDialog } from '../ui/AccessibleDialog';

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    setAuthModalOpen,
    language,
    startAuthenticatedSession,
    endAuthenticatedSession,
    isAuthenticated,
    currentUser,
    loadBackendData,
    addToast,
  } = useAppStore();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [displayNameAr, setDisplayNameAr] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [serverRoles, setServerRoles] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const isAr = language === 'ar';

  useEffect(() => {
    if (!isAuthModalOpen || !isAuthenticated) return;
    setDisplayName(currentUser.name);
    setDisplayNameAr(currentUser.nameAr);
    setError(null);
    void accountApi.me().then(({ data }) => setServerRoles(data.roles)).catch(() => setServerRoles([]));
  }, [currentUser.name, currentUser.nameAr, isAuthenticated, isAuthModalOpen]);

  if (!isAuthModalOpen) return null;

  const adoptProfile = async (profile: AuthenticatedProfile) => {
    let role = primaryUserRole(['READER']);
    try {
      const principal = (await accountApi.me()).data;
      role = primaryUserRole(principal.roles);
      setServerRoles(principal.roles);
    } catch {
      setServerRoles([]);
    }
    startAuthenticatedSession(profile, role);
    await loadBackendData();
  };

  const adoptUser = async (user: Parameters<typeof profileFromUser>[0]) => adoptProfile(profileFromUser(user));

  const handleLocalSubmit = async (): Promise<void> => {
    // Local development provider: password accounts live in MongoDB and the
    // server resolves roles through the same authorization model as production.
    setError(null);
    if (!email.trim() || !password) {
      setError(isAr ? 'أدخل البريد الإلكتروني وكلمة المرور.' : 'Enter an email address and password.');
      return;
    }
    if (mode === 'signup' && password.length < 10) {
      setError(isAr ? 'يجب ألا تقل كلمة المرور عن 10 أحرف.' : 'Password must contain at least 10 characters.');
      return;
    }
    try {
      const credentials = { email: email.trim(), password, displayName: displayName.trim(), displayNameAr: displayNameAr.trim() };
      const profile = mode === 'login' ? await localAuth.login(credentials) : await localAuth.register(credentials);
      await adoptProfile(profile);
      addToast(
        mode === 'login' ? 'Signed in securely. Your server role has been refreshed.' : 'Your local development account is ready.',
        mode === 'login' ? 'تم تسجيل الدخول بأمان وتحديث دورك من الخادم.' : 'تم إنشاء حساب التطوير المحلي بنجاح.',
        'success',
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (isAr ? 'تعذر إكمال عملية المصادقة.' : 'Authentication could not be completed.'));
      throw reason;
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!authConfigured) return;
    if (authMode === 'local') {
      setBusy(true);
      try {
        await handleLocalSubmit();
      } catch { /* Error already surfaced above. */ } finally {
        setBusy(false);
      }
      return;
    }
    if (!supabase) return;
    setError(null);
    if (!email.trim() || !password) {
      setError(isAr ? 'أدخل البريد الإلكتروني وكلمة المرور.' : 'Enter an email address and password.');
      return;
    }
    if (mode === 'signup' && password.length < 10) {
      setError(isAr ? 'يجب ألا تقل كلمة المرور عن 10 أحرف.' : 'Password must contain at least 10 characters.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'login') {
        const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError || !data.user) throw new Error(authError?.message || 'Unable to sign in.');
        await adoptUser(data.user);
        addToast('Signed in securely. Your server role has been refreshed.', 'تم تسجيل الدخول بأمان وتحديث دورك من الخادم.', 'success');
      } else {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: displayName.trim().slice(0, 80), display_name_ar: displayNameAr.trim().slice(0, 80) } },
        });
        if (authError || !data.user) throw new Error(authError?.message || 'Unable to create the account.');
        if (data.session) {
          await adoptUser(data.user);
          addToast('Your account is ready.', 'تم إنشاء حسابك بنجاح.', 'success');
        } else {
          setMode('login');
          setPassword('');
          addToast('Check your email to confirm the account, then sign in.', 'تحقق من بريدك الإلكتروني لتأكيد الحساب ثم سجّل الدخول.', 'info');
        }
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (isAr ? 'تعذر إكمال عملية المصادقة.' : 'Authentication could not be completed.'));
    } finally {
      setBusy(false);
    }
  };

  const handleProfileSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (authMode === 'local') {
      setBusy(true);
      setError(null);
      try {
        await adoptProfile(await localAuth.updateProfile(displayName.trim().slice(0, 80), displayNameAr.trim().slice(0, 80)));
        addToast('Profile settings saved.', 'تم حفظ إعدادات الملف الشخصي.', 'success');
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : (isAr ? 'تعذر حفظ إعدادات الحساب.' : 'Unable to save account settings.'));
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!supabase) return;
    setBusy(true);
    setError(null);
    try {
      const { data, error: authError } = await supabase.auth.updateUser({ data: { display_name: displayName.trim().slice(0, 80), display_name_ar: displayNameAr.trim().slice(0, 80) } });
      if (authError || !data.user) throw new Error(authError?.message || 'Unable to update account settings.');
      await adoptUser(data.user);
      addToast('Profile settings saved.', 'تم حفظ إعدادات الملف الشخصي.', 'success');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (isAr ? 'تعذر حفظ إعدادات الحساب.' : 'Unable to save account settings.'));
    } finally {
      setBusy(false);
    }
  };

  const handlePasswordSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword.length < 10) {
      setError(isAr ? 'يجب ألا تقل كلمة المرور الجديدة عن 10 أحرف.' : 'The new password must contain at least 10 characters.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (authMode === 'local') {
        await localAuth.updatePassword(newPassword);
      } else {
        if (!supabase) return;
        const { error: authError } = await supabase.auth.updateUser({ password: newPassword });
        if (authError) throw authError;
      }
      setNewPassword('');
      addToast('Password updated securely.', 'تم تحديث كلمة المرور بأمان.', 'success');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (isAr ? 'تعذر تحديث كلمة المرور.' : 'Unable to update password.'));
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    try {
      if (authMode === 'local') {
        await localAuth.logout();
      } else {
        if (!supabase) return;
        const { error: authError } = await supabase.auth.signOut();
        if (authError) throw authError;
      }
      endAuthenticatedSession();
      setAuthModalOpen(false);
      addToast('Signed out securely.', 'تم تسجيل الخروج بأمان.', 'info');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (isAr ? 'تعذر تسجيل الخروج.' : 'Unable to sign out.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AccessibleDialog open={isAuthModalOpen} onClose={() => setAuthModalOpen(false)} title={isAr ? 'حساب Nexara' : 'Nexara account'} initialFocusRef={closeButtonRef} className="w-full max-w-md">
      <motion.section initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-[#0B1712] border border-[#173125] rounded-3xl p-6 sm:p-8 text-[#E8E0CF] shadow-2xl space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs font-mono uppercase text-[#B89A5A]"><ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" /><span>{isAr ? 'حساب Nexara آمن' : 'Secure Nexara Account'}</span></div>
          <button ref={closeButtonRef} type="button" onClick={() => setAuthModalOpen(false)} aria-label={isAr ? 'إغلاق' : 'Close'} className="p-2 rounded-lg text-[#89977C] hover:text-[#E8E0CF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D2BB82]"><X className="w-4 h-4" aria-hidden="true" /></button>
        </div>
        <div>
          <h2 id="auth-modal-title" className="font-literary text-2xl font-bold text-[#E8E0CF]">{isAuthenticated ? (isAr ? 'إعدادات حسابك' : 'Account settings') : (mode === 'login' ? (isAr ? 'تسجيل الدخول' : 'Sign in') : (isAr ? 'إنشاء حساب' : 'Create an account'))}</h2>
          <p className="mt-1 text-xs leading-relaxed text-[#89977C]">{isAuthenticated ? (isAr ? 'يمكنك تعديل بياناتك الشخصية وكلمة المرور. الأدوار تُدار من الخادم فقط.' : 'You can edit your profile and password. Roles are managed server-side only.') : (isAr ? 'تُطبق الأدوار والصلاحيات من الخادم بعد تسجيل الدخول.' : 'Roles and permissions are applied by the server after sign-in.')}</p>
        </div>
        {!authConfigured && <p role="alert" className="rounded-xl border border-[#8B3A3A]/60 bg-[#1E0F11] px-3 py-2 text-xs leading-relaxed text-[#F3D5D7]">{isAr ? 'المصادقة غير مهيأة بعد.' : 'Authentication is not configured yet.'}</p>}
        {error && <p role="alert" className="rounded-xl border border-[#8B3A3A]/60 bg-[#1E0F11] px-3 py-2 text-xs text-[#F3D5D7]">{error}</p>}

        {isAuthenticated ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-[#07110D] border border-[#173125] space-y-2"><div className="text-sm font-bold text-[#E8E0CF]">{isAr ? currentUser.nameAr : currentUser.name}</div><div className="text-xs text-[#89977C] font-mono break-all">{currentUser.email}</div><div className="flex flex-wrap gap-1 pt-1">{(serverRoles.length ? serverRoles : ['READER']).map((serverRole) => <span key={serverRole} className="px-2 py-1 rounded-lg bg-[#173125] border border-[#687B61]/50 text-[10px] font-mono text-[#D2BB82]">{serverRole}</span>)}</div></div>
            <form onSubmit={(event) => void handleProfileSave(event)} className="space-y-3 p-4 rounded-2xl bg-[#07110D] border border-[#173125]"><div className="text-xs font-bold text-[#D2BB82]">{isAr ? 'الملف الشخصي' : 'Profile'}</div><label className="text-[11px] text-[#89977C] block">{isAr ? 'الاسم المعروض' : 'Display name'}<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} className="mt-1 w-full bg-[#0B1712] border border-[#173125] rounded-xl px-3 py-2 text-sm" /></label><label className="text-[11px] text-[#89977C] block">{isAr ? 'الاسم بالعربية' : 'Arabic display name'}<input value={displayNameAr} onChange={(event) => setDisplayNameAr(event.target.value)} maxLength={80} className="mt-1 w-full bg-[#0B1712] border border-[#173125] rounded-xl px-3 py-2 text-sm" /></label><button type="submit" disabled={busy} className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#173125] border border-[#687B61] text-xs font-bold text-[#D2BB82] disabled:opacity-50"><Save className="w-4 h-4" />{isAr ? 'حفظ الملف' : 'Save profile'}</button></form>
            <form onSubmit={(event) => void handlePasswordSave(event)} className="space-y-3 p-4 rounded-2xl bg-[#07110D] border border-[#173125]"><div className="text-xs font-bold text-[#D2BB82]">{isAr ? 'كلمة المرور' : 'Password'}</div><input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={10} placeholder={isAr ? 'كلمة مرور جديدة (10 أحرف على الأقل)' : 'New password (10+ characters)'} className="w-full bg-[#0B1712] border border-[#173125] rounded-xl px-3 py-2 text-sm" /><button type="submit" disabled={busy || !newPassword} className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#10231A] border border-[#687B61]/60 text-xs font-bold text-[#E8E0CF] disabled:opacity-50"><KeyRound className="w-4 h-4" />{isAr ? 'تحديث كلمة المرور' : 'Update password'}</button></form>
            <button type="button" disabled={busy} onClick={() => void handleLogout()} className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-[#1E0F11] border border-[#4A2528] text-[#F3D5D7] font-semibold text-xs disabled:opacity-50"><LogOut className="w-4 h-4" />{isAr ? 'تسجيل الخروج' : 'Sign out'}</button>
          </div>
        ) : (
          <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
            {mode === 'signup' && <><div><label htmlFor="auth-display-name" className="text-[11px] font-semibold text-[#89977C] block mb-1">{isAr ? 'الاسم المعروض' : 'Display name'}</label><input id="auth-display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} autoComplete="name" className="w-full bg-[#07110D] border border-[#173125] rounded-xl px-3 py-2 text-sm text-[#E8E0CF]" /></div><div><label htmlFor="auth-display-name-ar" className="text-[11px] font-semibold text-[#89977C] block mb-1">{isAr ? 'الاسم بالعربية' : 'Arabic display name'}</label><input id="auth-display-name-ar" value={displayNameAr} onChange={(event) => setDisplayNameAr(event.target.value)} maxLength={80} className="w-full bg-[#07110D] border border-[#173125] rounded-xl px-3 py-2 text-sm text-[#E8E0CF]" /></div></>}
            <div><label htmlFor="auth-email" className="text-[11px] font-semibold text-[#89977C] block mb-1">{isAr ? 'البريد الإلكتروني' : 'Email address'}</label><input id="auth-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required className="w-full bg-[#07110D] border border-[#173125] rounded-xl px-3 py-2 text-sm text-[#E8E0CF]" /></div>
            <div><label htmlFor="auth-password" className="text-[11px] font-semibold text-[#89977C] block mb-1">{isAr ? 'كلمة المرور' : 'Password'}</label><input id="auth-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'signup' ? 10 : undefined} required className="w-full bg-[#07110D] border border-[#173125] rounded-xl px-3 py-2 text-sm text-[#E8E0CF]" />{mode === 'signup' && <p className="mt-1 text-[10px] text-[#89977C]">{isAr ? '10 أحرف على الأقل.' : 'At least 10 characters.'}</p>}</div>
            <button type="submit" disabled={busy || !authConfigured} className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-[#B89A5A] hover:bg-[#D2BB82] text-[#07110D] font-bold text-xs disabled:opacity-50">{mode === 'login' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}{busy ? (isAr ? 'جارٍ المعالجة…' : 'Working…') : (mode === 'login' ? (isAr ? 'تسجيل الدخول' : 'Sign in') : (isAr ? 'إنشاء حساب' : 'Create account'))}</button>
            <button type="button" disabled={busy || !authConfigured} onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); }} className="w-full text-xs text-[#D2BB82] hover:text-[#E8E0CF] disabled:opacity-50 rounded-md">{mode === 'login' ? (isAr ? 'ليس لديك حساب؟ أنشئ حساباً' : 'New here? Create an account') : (isAr ? 'لديك حساب؟ سجّل الدخول' : 'Already have an account? Sign in')}</button>
          </form>
        )}
      </motion.section>
    </AccessibleDialog>
  );
};
