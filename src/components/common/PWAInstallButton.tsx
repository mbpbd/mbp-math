import React, { useState } from 'react';
import { Download, Smartphone, Share, MoreVertical, X, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  // Hide install UI when already running in standalone installed mode
  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (!accepted) {
        setShowGuideModal(true);
      }
      return;
    }
    setShowGuideModal(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        title="Android অথবা iPhone-এ অ্যাপ হিসেবে ইনস্টল করুন"
        className="px-2.5 sm:px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition cursor-pointer whitespace-nowrap"
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden sm:inline">অ্যাপ ইনস্টল</span>
        <span className="sm:hidden">অ্যাপ</span>
      </button>

      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 font-['Hind_Siliguri',sans-serif]">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-extrabold">ফোনে অ্যাপ হিসেবে ইনস্টল করুন</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
                aria-label="বন্ধ করুন"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs leading-relaxed">
              {isInstallable && (
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await install();
                    if (ok) setShowGuideModal(false);
                  }}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>এখনই ইনস্টল করুন (Install App)</span>
                </button>
              )}

              {/* iPhone / iPad Safari Guide */}
              <div className={`p-3.5 rounded-xl border ${isIOS ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-400' : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'}`}>
                <h4 className="font-extrabold text-sm text-indigo-700 dark:text-indigo-300 mb-1.5">
                  iPhone / iPad (Safari ব্রাউজার):
                </h4>
                <ol className="list-decimal pl-4 space-y-1 text-slate-700 dark:text-slate-300 m-0">
                  <li>
                    <strong>Safari</strong> ব্রাউজারে অ্যাপের লিংকটি খুলুন (Chrome বা অন্য অ্যাপের ইন-অ্যাপ ব্রাউজারে নয়)।
                  </li>
                  <li className="flex flex-wrap items-center gap-1">
                    নিচের টুলবারে থাকা <Share className="w-3.5 h-3.5 inline text-indigo-600 dark:text-indigo-400" /> <strong>Share</strong> আইকনে ট্যাপ করুন।
                  </li>
                  <li>
                    নিচে স্ক্রল করে <strong>&quot;Add to Home Screen&quot;</strong> চাপুন এবং ডানপাশের <strong>&quot;Add&quot;</strong> বাটনে ট্যাপ করুন।
                  </li>
                </ol>
              </div>

              {/* Android Chrome Guide */}
              <div className={`p-3.5 rounded-xl border ${!isIOS ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400' : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'}`}>
                <h4 className="font-extrabold text-sm text-emerald-700 dark:text-emerald-300 mb-1.5">
                  Android ফোন (Google Chrome ব্রাউজার):
                </h4>
                <ol className="list-decimal pl-4 space-y-1 text-slate-700 dark:text-slate-300 m-0">
                  <li>
                    <strong>Google Chrome</strong>-এ সরাসরি অ্যাপের লিংক খুলুন।
                  </li>
                  <li className="flex flex-wrap items-center gap-1">
                    উপরে ডানদিকের <MoreVertical className="w-3.5 h-3.5 inline text-emerald-600 dark:text-emerald-400" /> <strong>মেনু (তিন ডট)</strong> আইকনে ট্যাপ করুন।
                  </li>
                  <li>
                    <strong>&quot;Install app&quot;</strong> অথবা <strong>&quot;Add to Home screen&quot;</strong> নির্বাচন করে <strong>&quot;Install&quot;</strong> চাপুন।
                  </li>
                </ol>
              </div>

              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="w-full py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl transition cursor-pointer"
              >
                বুঝেছি, বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
