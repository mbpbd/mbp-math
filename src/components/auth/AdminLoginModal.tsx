import React, { useState } from 'react';
import { ShieldCheck, AlertCircle, ArrowLeft, LogIn } from 'lucide-react';
import { AdminSessionUser, signInAdminWithGoogle } from '../../config/firebase';

interface AdminLoginModalProps {
  onLoginSuccess: (user: AdminSessionUser) => void;
  onClose?: () => void;
  initialError?: string | null;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  onLoginSuccess,
  onClose,
  initialError = null
}) => {
  const [error, setError] = useState<string | null>(initialError);
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const verifiedAdmin = await signInAdminWithGoogle();
      onLoginSuccess(verifiedAdmin);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setError('Google লগইন পপ-আপ বন্ধ করা হয়েছে। পুনরায় চেষ্টা করুন।');
      } else if (code === 'auth/popup-blocked') {
        setError('ব্রাউজার পপ-আপ ব্লক করেছে। পপ-আপ অনুমতি দিয়ে আবার চেষ্টা করুন।');
      } else {
        setError(
          err instanceof Error && err.message
            ? err.message
            : 'Google লগইন ব্যর্থ হয়েছে। শুধুমাত্র অনুমোদিত অ্যাডমিন ইমেইল ব্যবহার করুন।'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 font-['Hind_Siliguri',sans-serif]">
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        
        {/* Top Header */}
        <div className="text-center space-y-3 mb-6">
          <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto border border-indigo-200 dark:border-indigo-800 shadow-sm">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">
              MBP অ্যাডমিন লগইন
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              মণিপুরি বিজ্ঞান প্রজন্ম কুইজ কন্ট্রোল প্যানেলে Google অ্যাকাউন্ট দিয়ে প্রবেশ করুন
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-xs font-semibold flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 leading-relaxed">
            নিরাপত্তার স্বার্থে পাসওয়ার্ডের পরিবর্তে অনুমোদিত <strong>Google Authentication</strong> চালু করা হয়েছে। একবার লগইন করলে সেশন ব্রাউজারে সংরক্ষিত থাকবে।
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full py-3.5 px-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border-2 border-slate-300 dark:border-slate-600 active:scale-[0.98] text-slate-900 dark:text-white rounded-xl font-bold text-sm shadow-md transition flex items-center justify-center gap-3 cursor-pointer disabled:opacity-60"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-8.97Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.37 24 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.37 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
              />
            </svg>
            <span>{isLoading ? 'Google অ্যাকাউন্ট যাচাই হচ্ছে...' : 'Google দিয়ে লগইন করুন'}</span>
            <LogIn className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </button>
        </div>

        {onClose && (
          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-semibold flex items-center justify-center gap-1 mx-auto cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>পাবলিক পোর্টালে ফিরে যান</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
