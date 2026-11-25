import React from 'react';
import { CATEGORIES, CategoryCode, ContestSettings, NumberBlock, School, Venue } from '../../types';
import { toBengaliDigits } from '../../services/idSystem';

interface BundleCoverSheetProps {
  school: School;
  venue: Venue;
  settings: ContestSettings;
  blocks: NumberBlock[];
  teacherPortalUrl: string;
  qrDataUrl: string;
}

export const BundleCoverSheet: React.FC<BundleCoverSheetProps> = ({
  school,
  venue,
  settings,
  blocks,
  teacherPortalUrl,
  qrDataUrl
}) => {
  const schoolBlocks = blocks.filter(b => b.schoolId === school.id);
  const totalForms = schoolBlocks.reduce((acc, b) => acc + b.count, 0);

  // Group IDs strictly category-wise for separated tick grids (User Requirement)
  const categoryIdsMap: Record<CategoryCode, Array<{ id: string; last4: string }>> = {
    '01': [],
    '02': [],
    '03': []
  };

  schoolBlocks.forEach(b => {
    for (let s = b.firstSerial; s <= b.lastSerial; s++) {
      const padded = String(s).padStart(settings.serialDigits || 3, '0');
      const fullId = `${settings.yearCode}${b.category}${padded}`;
      categoryIdsMap[b.category].push({
        id: fullId,
        last4: fullId.slice(-4) // Exact 4-digit representation: e.g. "1001", "2001", "3001"
      });
    }
  });

  return (
    <div className="a4-sheet bg-white text-black mx-auto w-[205mm] max-w-[205mm] h-[290mm] max-h-[290mm] p-[2.5mm] flex flex-col justify-between font-['Hind_Siliguri',sans-serif] text-[12px] leading-tight select-none print:m-0 print:p-[1.5mm] print:w-full print:h-[291mm] print:break-after-page shadow-md print:shadow-none box-border overflow-hidden">
      
      {/* Header with MBP Logo and Title */}
      <div className="border-b-4 border-black pb-2 mb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img 
            src="/assets/aistudio/mbp_d0333f88.jpg" 
            alt="MBP Logo" 
            className="w-14 h-14 object-contain rounded"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <div>
            <div className="inline-block bg-black text-white font-black text-[10px] px-2 py-0.5 rounded uppercase tracking-wider mb-0.5">
              স্কুল বান্ডিল কভার শীট (BUNDLE COVER SHEET)
            </div>
            <h1 className="text-xl font-black text-black tracking-tight leading-snug">{settings.contestNameBn}</h1>
            <p className="text-xs text-black font-extrabold">আয়োজনে: {settings.organiserBn}</p>
          </div>
        </div>

        {/* Total Seats Box with Solid Black Font (User Request #5) */}
        <div className="text-right border-2 border-black p-2 rounded-lg bg-gray-50">
          <span className="text-[10px] text-black font-black uppercase block">মোট বরাদ্দকৃত ফর্ম (TOTAL SEATS)</span>
          <span className="text-2xl font-black text-black font-mono">
            {toBengaliDigits(totalForms)} <span className="text-xs font-black text-black">টি</span>
          </span>
        </div>
      </div>

      {/* School, Venue & Teacher Secret PIN Card */}
      <div className="grid grid-cols-3 gap-2.5 mb-2">
        <div className="col-span-2 border-2 border-black rounded-lg p-2.5 bg-gray-50">
          <h2 className="text-[10px] font-black text-black uppercase tracking-wider">বিদ্যালয়ের বিবরণ ও ভেন্যু</h2>
          <p className="text-base font-black text-black">{school.name}</p>
          {school.nameEn && <p className="text-[11px] text-black font-bold uppercase">{school.nameEn}</p>}
          <div className="mt-1.5 pt-1.5 border-t border-gray-400 text-[11px] grid grid-cols-2 gap-2 text-black">
            <div>
              <span className="font-bold">উপজেলা: </span>
              <span className="font-black">{school.upazila}</span>
            </div>
            <div>
              <span className="font-bold">পরীক্ষার ভেন্যু: </span>
              <span className="font-black">{venue.name}</span>
            </div>
          </div>
        </div>

        {/* 4-Digit Teacher PIN Box */}
        <div className="border-2 border-black bg-yellow-100 rounded-lg p-2 text-center flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-black text-black block uppercase">শিক্ষক প্যানেল লগইন পিন</span>
            <span className="text-[9px] text-black block font-bold">(গোপনীয় - শুধুমাত্র প্রতিনিধির জন্য)</span>
          </div>
          <div className="py-1 bg-white rounded border-2 border-black font-mono font-black text-2xl text-black tracking-widest shadow-inner">
            {school.plainPin || '••••'}
          </div>
          <span className="text-[9px] text-black font-bold">এই পিন দিয়ে শিক্ষক প্যানেলে লগইন করুন</span>
        </div>
      </div>

      {/* Number Ranges per Category with Solid Black Font (User Request #5) */}
      <div className="border-2 border-black rounded-lg p-2 mb-2 bg-white">
        <h3 className="font-black text-xs text-black mb-1.5 flex items-center gap-1.5">
          <span>📋</span>
          <span>এই বান্ডিলের রেজিস্ট্রেশন নম্বর পরিসীমা (Number Ranges)</span>
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {(['01', '02', '03'] as CategoryCode[]).map(cat => {
            const block = schoolBlocks.find(b => b.category === cat);
            const catInfo = CATEGORIES[cat];
            return (
              <div 
                key={cat} 
                className="border-2 border-black rounded p-1.5 bg-gray-50 text-black"
              >
                <div className="flex justify-between items-center mb-0.5">
                  <span className="font-black text-xs text-black">{catInfo.nameBn}</span>
                  <span className="text-[10px] font-black text-black">
                    {block ? `${toBengaliDigits(block.count)} টি` : '০ টি'}
                  </span>
                </div>
                {block ? (
                  <div className="font-mono text-xs font-black text-black bg-white p-0.5 rounded border border-black text-center">
                    {block.firstId} – {block.lastId}
                  </div>
                ) : (
                  <div className="text-[10px] text-black font-bold italic text-center py-0.5">বরাদ্দ নেই</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3 Step Instructions for Teacher + QR code to Teacher Portal */}
      <div className="border-2 border-black bg-gray-50 rounded-lg p-2.5 mb-2 flex gap-3 items-center text-black">
        <div className="flex-1">
          <h3 className="font-black text-black text-xs mb-1 flex items-center gap-1">
            <span>📱</span>
            <span>শিক্ষক প্রতিনিধির জন্য ৩টি সহজ ধাপ (মোবাইল থেকে রিপোর্ট করুন)</span>
          </h3>
          <ol className="space-y-1 text-[11px] text-black font-semibold">
            <li className="flex gap-1.5">
              <span className="w-4 h-4 rounded-full bg-black text-white flex items-center justify-center text-[10px] font-bold shrink-0">১</span>
              <span>শিক্ষার্থীকে ফর্ম দিন এবং নিচের অংশটি (প্রবেশপত্র) ছিঁড়ে তার হাতে দিয়ে দিন।</span>
            </li>
            <li className="flex gap-1.5">
              <span className="w-4 h-4 rounded-full bg-black text-white flex items-center justify-center text-[10px] font-bold shrink-0">২</span>
              <span>ডানদিকের কিউআর কোড স্ক্যান করে অথবা লিংকে গিয়ে আপনার স্কুল সিলেক্ট করে ৪-ডিজিট পিন দিন।</span>
            </li>
            <li className="flex gap-1.5">
              <span className="w-4 h-4 rounded-full bg-black text-white flex items-center justify-center text-[10px] font-bold shrink-0">৩</span>
              <span>যে যে নম্বরগুলো দিয়েছেন সেগুলোতে স্ক্রিনে ট্যাপ করে <strong>'পাঠান'</strong> চাপুন। (কোনো টাইপিং প্রয়োজন নেই)</span>
            </li>
          </ol>
        </div>

        {/* QR to Teacher Portal */}
        <div className="text-center shrink-0 border-l border-gray-400 pl-3">
          <span className="text-[9px] font-black text-black block mb-0.5">শিক্ষক প্যানেল QR</span>
          {qrDataUrl && (
            <img 
              src={qrDataUrl} 
              alt="Teacher QR" 
              className="w-16 h-16 border-2 border-black p-0.5 bg-white rounded object-contain mx-auto"
            />
          )}
          <span className="text-[8px] text-black block mt-0.5 font-mono font-bold">{teacherPortalUrl}</span>
        </div>
      </div>

      {/* Category-Separated Paper Backup Tick Grids with Solid Black Font (User Request #5) */}
      <div className="flex-1 border-2 border-black rounded-lg p-2 bg-white flex flex-col justify-between overflow-hidden text-black">
        <div className="flex justify-between items-center pb-1 border-b border-black">
          <h4 className="font-black text-[11px] text-black flex items-center gap-1">
            <span>☑️</span>
            <span>কাগজের ব্যাকআপ টিক গ্রিড (৪ ডিজিট নম্বরসহ ক্যাটাগরিভিত্তিক পৃথক তালিকা)</span>
          </h4>
          <span className="text-[9px] text-black font-bold">নম্বর দেওয়ার সাথে সাথে ঘরে টিক (✓) দিন</span>
        </div>

        <div className="space-y-1.5 py-1 flex-1 overflow-hidden">
          {(['01', '02', '03'] as CategoryCode[]).map(cat => {
            const items = categoryIdsMap[cat];
            if (items.length === 0) return null;
            const catInfo = CATEGORIES[cat];

            return (
              <div key={cat} className="border border-black rounded p-1 bg-gray-50">
                <div className="flex justify-between items-center mb-0.5">
                  <span className="font-black text-[11px] text-black">
                    {catInfo.nameBn} (ক্যাটাগরি {cat}) — মোট {toBengaliDigits(items.length)} টি (TOTAL: {items.length})
                  </span>
                  <span className="text-[10px] text-black font-mono font-black">
                    {items[0].last4} – {items[items.length - 1].last4}
                  </span>
                </div>

                <div className="grid grid-cols-10 gap-0.5 text-center font-mono text-[9px]">
                  {items.map(item => (
                    <div 
                      key={item.id} 
                      className="border border-black p-0.5 rounded-sm flex items-center justify-between px-1 bg-white"
                    >
                      <span className="font-black text-black">{item.last4}</span>
                      <span className="w-2.5 h-2.5 border border-black rounded-xs inline-block"></span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Info */}
        <div className="pt-1 text-[9.5px] text-black flex justify-between items-center border-t border-black font-bold">
          <span>হেল্পলাইন: {settings.helplineNumbers}</span>
          <span>মণিপুরি বিজ্ঞান প্রজন্ম — Manipuri Biggan Projonmo</span>
        </div>
      </div>

    </div>
  );
};
