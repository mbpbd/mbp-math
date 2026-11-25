import React from 'react';
import { CATEGORIES, CategoryCode, ContestSettings, Venue, getSyllabusParagraphs } from '../../types';
import { toBengaliDigits } from '../../services/idSystem';

interface PrintedFormSheetProps {
  registrationId: string; // e.g. "2601001" .. "2601500"
  category: CategoryCode;
  schoolName: string;
  venue: Venue;
  settings: ContestSettings;
  qrDataUrl: string;
  isCategoryMode?: boolean;
}

const DOT_STRING = '........................................................................................................................................................................';

const DottedFill: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span
    aria-hidden="true"
    className={`flex-1 min-w-0 overflow-hidden whitespace-nowrap ml-1.5 text-[11px] leading-none tracking-[1.5px] text-black font-normal select-none ${className}`}
  >
    {DOT_STRING}
  </span>
);

export const PrintedFormSheet: React.FC<PrintedFormSheetProps> = ({
  registrationId,
  category,
  schoolName,
  venue,
  settings,
  qrDataUrl,
  isCategoryMode = false
}) => {
  const catInfo = CATEGORIES[category];
  // Always display at least 7 boxes; '_' indicates an empty box for manual writing
  const digits = (
    registrationId.length >= 7 ? registrationId : registrationId.padEnd(7, '_')
  ).split('');
  const isManualBlank = registrationId.includes('_');
  const useCategoryAdmitLayout = isCategoryMode || isManualBlank;

  const categoryBgBanner = category === '01'
    ? 'bg-sky-700 text-white'
    : category === '02'
      ? 'bg-emerald-700 text-white'
      : 'bg-amber-700 text-white';

  const categoryBadgeBorder = category === '01'
    ? 'border-sky-600 text-sky-800'
    : category === '02'
      ? 'border-emerald-600 text-emerald-800'
      : 'border-amber-600 text-amber-800';

  return (
    <div className="a4-sheet bg-white text-black mx-auto w-[205mm] max-w-[205mm] h-[290mm] max-h-[290mm] p-[1.5mm] flex flex-col justify-between font-['Hind_Siliguri',sans-serif] text-[11px] leading-tight select-none print:m-0 print:p-[1mm] print:w-full print:h-[291mm] print:break-after-page shadow-md print:shadow-none box-border overflow-hidden">
      
      {/* =========================================================================
          TOP PART: REGISTRATION FORM (মণিপুরি বিজ্ঞান প্রজন্ম কর্তৃক সংরক্ষিত)
         ========================================================================= */}
      <div className="flex-1 flex flex-col justify-between border-2 border-black p-2 rounded-xs relative max-h-[140mm] overflow-hidden">
        {/* Category Header Band */}
        <div className={`-mx-2 -mt-2 mb-1 px-2.5 py-0.5 flex items-center justify-between ${categoryBgBanner}`}>
          <span className="font-extrabold tracking-wide text-[11px]">রেজিস্ট্রেশন ফরম (মূল কপি) — MBP অফিস কপি</span>
          <span className="font-extrabold tracking-wider text-[11px]">{catInfo.nameBn} (শ্রেণি: {catInfo.classes.map(c => toBengaliDigits(c)).join(', ')})</span>
        </div>

        {/* Header with Logo and Contest Info */}
        <div className="flex items-center justify-between border-b border-gray-300 pb-1">
          <div className="flex items-center gap-2">
            <img 
              src="/assets/aistudio/mbp_d0333f88.jpg" 
              alt="MBP Logo" 
              className="w-10 h-10 object-contain rounded"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div>
              <p className="text-[10px] font-bold text-gray-700 leading-tight">মণিপুরি বিজ্ঞান প্রজন্মের আয়োজনে</p>
              <h1 className="text-base font-black text-black tracking-tight leading-snug">{settings.contestNameBn}</h1>
              <p className="text-[9.5px] text-gray-900 font-semibold">স্থান: {venue.name}, {venue.address}</p>
            </div>
          </div>

          {/* Registration Number & QR */}
          <div className="flex items-center gap-1.5">
            <div className="text-right">
              <span className="text-[9px] font-black text-black block mb-0.5">রেজিস্ট্রেশন নম্বর</span>
              <div className="flex gap-0.5 justify-end font-mono">
                {digits.map((digit, idx) => (
                  <div 
                    key={idx} 
                    className={`w-4.5 h-6 border border-black flex items-center justify-center font-bold text-xs ${
                      digit === '_' ? 'bg-white text-transparent' : 'bg-gray-50 text-black'
                    }`}
                  >
                    {digit === '_' ? '' : digit}
                  </div>
                ))}
              </div>
            </div>
            {qrDataUrl && !isManualBlank && (
              <img 
                src={qrDataUrl} 
                alt={`QR ${registrationId}`} 
                className="w-11 h-11 border border-black p-0.5 object-contain"
              />
            )}
          </div>
        </div>

        {/* Pre-printed Info Row */}
        <div className="grid grid-cols-2 gap-2 my-1 py-1.5 px-2 bg-gray-100 rounded border border-gray-400 text-[10.5px]">
          <div className="flex items-end min-w-0">
            <span className="font-bold text-black whitespace-nowrap">বিদ্যালয়: </span>
            {schoolName ? (
              <span className="font-black text-black ml-1">{schoolName}</span>
            ) : (
              <DottedFill />
            )}
          </div>
          <div className="text-right">
            <span className="font-bold text-black">ক্যাটাগরি: </span>
            <span className={`inline-block px-1 py-0.2 font-black rounded border ${categoryBadgeBorder}`}>
              {catInfo.nameBn} (শ্রেণি: {catInfo.classes.map(c => toBengaliDigits(c)).join(', ')})
            </span>
          </div>
        </div>

        {/* Blank Fields for Student Information (True Dot Lines with generous handwriting space) */}
        <div className="space-y-4 py-2 text-[11px]">
          <div className="flex items-end pt-1.5 min-w-0">
            <span className="whitespace-nowrap font-bold text-black">অংশগ্রহণকারীর নাম (বাংলা):</span>
            <DottedFill />
          </div>
          <div className="flex items-end pt-1.5 min-w-0">
            <span className="whitespace-nowrap font-bold text-black">Name (ENGLISH CAPITALS):</span>
            <DottedFill />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1.5">
            <div className="flex items-end min-w-0">
              <span className="whitespace-nowrap font-bold text-black">পিতার নাম:</span>
              <DottedFill />
            </div>
            <div className="flex items-end min-w-0">
              <span className="whitespace-nowrap font-bold text-black">মাতার নাম:</span>
              <DottedFill />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-1.5">
            <div className="flex items-end min-w-0">
              <span className="whitespace-nowrap font-bold text-black">শ্রেণি:</span>
              <DottedFill />
            </div>
            <div className="flex items-end col-span-2 min-w-0">
              <span className="whitespace-nowrap font-bold text-black">মোবাইল নম্বর (SMS যাবে):</span>
              <DottedFill />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-1.5">
            <div className="flex items-end min-w-0">
              <span className="whitespace-nowrap font-bold text-black">গ্রাম / পাড়া:</span>
              <DottedFill />
            </div>
            <div className="flex items-end min-w-0">
              <span className="whitespace-nowrap font-bold text-black">উপজেলা:</span>
              <DottedFill />
            </div>
            <div className="flex items-end min-w-0">
              <span className="whitespace-nowrap font-bold text-black">জেলা:</span>
              <DottedFill />
            </div>
          </div>
        </div>

        {/* Footer Warning & Signatures */}
        <div className="border-t border-gray-300 pt-2 flex items-end justify-between text-[9px] text-black">
          <p className="text-red-700 font-bold italic">
            * অসম্পূর্ণ ফর্ম গ্রহণযোগ্য হবে না।
          </p>
          <div className="flex items-end gap-16 pr-2">
            <div className="text-center">
              <div className="w-28 h-4 border-b border-gray-700 mb-0.5"></div>
              <span className="font-semibold">অভিভাবকের স্বাক্ষর</span>
            </div>
            <div className="text-center">
              <div className="w-28 h-4 border-b border-gray-700 mb-0.5"></div>
              <span className="font-semibold">শিক্ষক / প্রতিনিধির স্বাক্ষর</span>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SEPARATION / CUT LINE WITH SCISSORS ICON
         ========================================================================= */}
      <div className="my-1 relative flex items-center justify-center">
        <div className="w-full overflow-hidden whitespace-nowrap text-gray-600 text-[10px] tracking-[2px] text-center select-none">
          {'- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -'}
        </div>
        <div className="absolute bg-white px-2.5 py-0.2 text-[10px] text-black font-extrabold flex items-center gap-1 border border-gray-400 rounded-full">
          <span>✂</span>
          <span>এখানে কেটে নিন — নিচের অংশটি প্রবেশপত্র (শিক্ষার্থী বাড়ি নিয়ে যাবে)</span>
          <span>✂</span>
        </div>
      </div>

      {/* =========================================================================
          BOTTOM PART: ADMIT CARD (প্রবেশপত্র — শিক্ষার্থীর কপি)
         ========================================================================= */}
      <div className="flex-1 flex flex-col justify-between border-2 border-black p-2 rounded-xs relative max-h-[140mm] overflow-hidden">
        {/* Admit Card Banner */}
        <div className={`-mx-2 -mt-2 mb-1 px-2.5 py-0.5 flex items-center justify-between ${categoryBgBanner}`}>
          <span className="font-extrabold tracking-wide text-[11px]">প্রবেশপত্র (ADMIT CARD) — শিক্ষার্থী কপি</span>
          <span className="font-extrabold tracking-wider text-[11px]">{catInfo.nameBn}</span>
        </div>

        {/* Admit Header */}
        <div className="flex items-center justify-between border-b border-gray-300 pb-1">
          <div className="flex items-center gap-2">
            <img 
              src="/assets/aistudio/mbp_d0333f88.jpg" 
              alt="MBP Logo" 
              className="w-10 h-10 object-contain rounded"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div>
              <h2 className="text-sm font-black text-black leading-tight">{settings.contestNameBn}</h2>
              <p className="text-[9.5px] font-semibold text-gray-700">আয়োজনে: {settings.organiserBn}</p>
              <p className="text-[9.5px] text-black font-bold mt-0.5">
                তারিখ ও সময়: <span className="text-red-700">{settings.quizDateTextBn}, {settings.quizTimeTextBn}</span>
              </p>
            </div>
          </div>

          {/* Registration Number & QR */}
          <div className="flex items-center gap-1.5">
            <div className="text-right">
              <span className="text-[9px] font-black text-black block mb-0.5">রেজিস্ট্রেশন নম্বর</span>
              {useCategoryAdmitLayout ? (
                <div className="flex gap-0.5 justify-end font-mono">
                  {digits.map((digit, idx) => (
                    <div
                      key={idx}
                      className={`w-4.5 h-5.5 border border-black flex items-center justify-center font-bold text-xs ${
                        digit === '_' ? 'bg-white text-transparent' : 'bg-gray-100 text-black'
                      }`}
                    >
                      {digit === '_' ? '' : digit}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-1.5 py-0.5 bg-gray-100 border border-black font-mono font-black text-xs text-black rounded">
                  {registrationId}
                </div>
              )}
            </div>
            {qrDataUrl && !isManualBlank && (
              <img 
                src={qrDataUrl} 
                alt={`Admit QR ${registrationId}`} 
                className="w-11 h-11 border border-black p-0.5 object-contain"
              />
            )}
          </div>
        </div>

        {/* Venue & School Info — Keep School-wise original layout; Category-wise gets triple-size empty school line */}
        {useCategoryAdmitLayout ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 my-0.5 p-1.5 bg-gray-50 border border-gray-300 rounded text-[10.5px]">
            <div>
              <p><span className="font-bold text-black">পরীক্ষার ভেন্যু:</span> <span className="font-black text-black">{venue.name}</span></p>
              <p className="text-[9.5px] text-gray-700">{venue.address}</p>
            </div>
            <div className="text-right flex flex-col justify-center">
              <p className="text-[10px] text-gray-700">ক্যাটাগরি: <span className="font-black text-black">{catInfo.nameBn}</span></p>
            </div>
            <div className="col-span-2 flex items-end pt-3 border-t border-gray-200 min-w-0">
              <span className="font-bold text-black whitespace-nowrap">বিদ্যালয়:</span>
              {schoolName ? (
                <span className="font-black text-black ml-1.5">{schoolName}</span>
              ) : (
                <DottedFill />
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 my-0.5 p-1 bg-gray-50 border border-gray-300 rounded text-[10.5px]">
            <div>
              <p><span className="font-bold text-black">পরীক্ষার ভেন্যু:</span> <span className="font-black text-black">{venue.name}</span></p>
              <p className="text-[9.5px] text-gray-700">{venue.address}</p>
            </div>
            <div className="text-right flex flex-col justify-between">
              <div className="flex items-end justify-end min-w-0">
                <span className="font-bold text-black whitespace-nowrap">বিদ্যালয়:</span>
                {schoolName ? (
                  <span className="font-black text-black ml-1">{schoolName}</span>
                ) : (
                  <DottedFill />
                )}
              </div>
              <p className="text-[9.5px] text-gray-700">ক্যাটাগরি: <span className="font-black text-black">{catInfo.nameBn}</span></p>
            </div>
          </div>
        )}

        {/* Blank Fields filled on spot (True Dot Lines with generous handwriting space) */}
        <div className="grid grid-cols-3 gap-3 my-2 pt-2.5 text-[11px]">
          <div className="flex items-end col-span-2 min-w-0">
            <span className="whitespace-nowrap font-bold text-black">অংশগ্রহণকারীর নাম:</span>
            <DottedFill />
          </div>
          <div className="flex items-end min-w-0">
            <span className="whitespace-nowrap font-bold text-black">শ্রেণি:</span>
            <DottedFill />
          </div>
        </div>

        {/* Vital Rule Line */}
        <div className="p-1 my-0.5 bg-yellow-50 border-l-4 border-red-600 text-red-950 text-[9.5px] font-bold leading-tight">
          ⚠️ প্রবেশপত্র ছাড়া পরীক্ষা কক্ষে প্রবেশ নিষেধ। আসন নম্বর ও ফলাফল ওয়েবসাইটে দেখা যাবে।
        </div>

        {/* Syllabus Box (Category-wise: shows only the matching category syllabus) */}
        <div className="my-0.5 border border-black rounded overflow-hidden text-[9.5px] leading-snug bg-white">
          <div className="bg-gray-200 px-2 py-0.5 font-black text-black flex justify-between items-center text-[9px] border-b border-gray-300">
            <span>কুইজ সিলেবাস — {catInfo.nameBn} (শ্রেণি: {catInfo.classes.map(c => toBengaliDigits(c)).join(', ')})</span>
            <span>হেল্পলাইন: {settings.helplineNumbers}</span>
          </div>
          <div className="px-2 py-1.5 flex items-start gap-1.5 bg-white">
            <span
              className={`font-black shrink-0 ${
                category === '01'
                  ? 'text-sky-800'
                  : category === '02'
                    ? 'text-emerald-800'
                    : 'text-amber-800'
              }`}
            >
              {catInfo.nameBn}:
            </span>
            <div className="flex-1 min-w-0 space-y-1.5 text-black font-medium">
              {getSyllabusParagraphs(
                settings.syllabuses?.[category] || `${catInfo.syllabusBn}\n${catInfo.syllabusEn}`
              ).map((para, idx) => (
                <p key={idx} className="m-0 leading-snug">
                  {para}
                </p>
              ))}
            </div>
          </div>
        </div>

        {/* Rules Footer */}
        <div className="flex items-center justify-between text-[9px] text-gray-700 pt-0.5 border-t border-gray-300">
          <span>• পরীক্ষার ৩০ মিনিট পূর্বে কেন্দ্রে পৌঁছাতে হবে। ক্যালকুলেটর বা মোবাইল ফোন সম্পূর্ণ নিষিদ্ধ।</span>
          <span className="font-bold text-black">ফেসবুক: {settings.facebookPage}</span>
        </div>
      </div>

    </div>
  );
};
