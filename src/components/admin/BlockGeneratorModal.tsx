import React, { useState } from 'react';
import { CategoryCode, NumberBlock, School, Venue } from '../../types';
import { allocateSchoolBlocks, AllocationResult } from '../../services/blockAllocation';
import { toBengaliDigits, formatRegistrationId } from '../../services/idSystem';
import { getPreferredExamVenueId } from '../../services/defaultData';
import { Layers, AlertCircle, CheckCircle2, ShieldAlert, Plus, Check } from 'lucide-react';

interface BlockGeneratorModalProps {
  schools: School[];
  venues: Venue[];
  existingBlocks: NumberBlock[];
  contestYear?: string;
  onlineSerialStart?: number;
  onCommitBlocks: (blocks: NumberBlock[]) => Promise<void>;
  onClose: () => void;
}

export const BlockGeneratorModal: React.FC<BlockGeneratorModalProps> = ({
  schools,
  venues,
  existingBlocks,
  contestYear = '26',
  onlineSerialStart = 601,
  onCommitBlocks,
  onClose
}) => {
  const [allocation, setAllocation] = useState<AllocationResult>(() => {
    return allocateSchoolBlocks({
      schools,
      venues,
      contestYear,
      onlineSerialStart,
      existingBlocks: []
    });
  });

  const [spareCategory, setSpareCategory] = useState<CategoryCode>('01');
  const [spareFirst, setSpareFirst] = useState<number>(501);
  const [spareCount, setSpareCount] = useState<number>(50);
  const [spareVenueId, setSpareVenueId] = useState<string>(() => getPreferredExamVenueId(venues));
  const [isAddingSpare, setIsAddingSpare] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleAddSpareBlock = () => {
    const lastSerial = spareFirst + spareCount - 1;
    const venue = venues.find(v => v.id === spareVenueId);
    const venueName = venue?.name || 'অতিরিক্ত স্পেয়ার ভেন্যু';

    const newSpareBlock: NumberBlock = {
      id: `blk-spare-${spareCategory}-${spareFirst}`,
      type: 'spare',
      category: spareCategory,
      firstSerial: spareFirst,
      lastSerial,
      firstId: formatRegistrationId(contestYear, spareCategory, spareFirst),
      lastId: formatRegistrationId(contestYear, spareCategory, lastSerial),
      count: spareCount,
      venueId: spareVenueId,
      venueName,
      createdAt: new Date().toISOString()
    };

    // Recheck overlaps
    const updatedBlocks = [...allocation.blocks, newSpareBlock];
    setAllocation({
      ...allocation,
      blocks: updatedBlocks,
      previewRows: [
        ...allocation.previewRows,
        {
          schoolId: 'SPARE',
          schoolName: `[স্পেয়ার ব্লক - ওয়াক-ইন/জরুরি]`,
          category: spareCategory,
          count: spareCount,
          firstSerial: spareFirst,
          lastSerial,
          firstId: newSpareBlock.firstId,
          lastId: newSpareBlock.lastId,
          venueId: spareVenueId,
          venueName
        }
      ]
    });

    setIsAddingSpare(false);
  };

  const handleSave = async () => {
    if (!allocation.success || allocation.blocks.length === 0) return;
    setIsSaving(true);
    try {
      await onCommitBlocks(allocation.blocks);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-200 dark:border-slate-800">
        
        {/* Header */}
        <div className="p-5 border-b border-gray-200 dark:border-slate-800 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>রেজিস্ট্রেশন নম্বর ব্লক জেনারেশন ও পূর্বরূপ</span>
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              বিদ্যালয়ের প্রয়োজনীয় ফর্ম সংখ্যা অনুযায়ী স্বয়ংক্রিয় ধারাবাহিক ও অভিন্ন ব্লক বণ্টন।
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg font-bold p-1"
          >
            ✕
          </button>
        </div>

        {/* Content body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          
          {/* Rules and Invariant Verification Badge */}
          <div className="flex flex-wrap gap-2 items-center justify-between p-3 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-900/40">
            <div className="flex items-center gap-2">
              {allocation.success ? (
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
              )}
              <div>
                <span className="font-bold text-gray-900 dark:text-white text-xs block">
                  {allocation.success ? 'ওভারল্যাপ শূন্যতা নিশ্চিত — সকল ব্লক বৈধ ও ধারাবাহিক' : 'ব্লক বণ্টনে ত্রুটি সনাক্ত হয়েছে'}
                </span>
                <span className="text-[11px] text-gray-600 dark:text-gray-300">
                  অনলাইন সংরক্ষিত ক্রমিক: {onlineSerialStart}-৯৯৯ | সর্বোচ্চ স্কুল ক্রমিক সীমা: {onlineSerialStart - 1}
                </span>
              </div>
            </div>

            <button
              onClick={() => setIsAddingSpare(!isAddingSpare)}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 font-semibold rounded-lg hover:bg-indigo-50 flex items-center gap-1 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>স্পেয়ার/জরুরি ব্লক যোগ করুন</span>
            </button>
          </div>

          {/* Errors list if any */}
          {allocation.errors.length > 0 && (
            <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200 space-y-1">
              {allocation.errors.map((err, i) => (
                <div key={i} className="flex items-start gap-1.5 font-medium">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{err}</span>
                </div>
              ))}
            </div>
          )}

          {/* Spare Block Creator */}
          {isAddingSpare && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl space-y-2">
              <span className="font-bold text-amber-900 dark:text-amber-200 block">
                ওয়াক-ইন ও অতিরিক্ত স্পেয়ার ব্লক বরাদ্দ (Spare Block)
              </span>
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-700 dark:text-gray-300 mb-0.5">ক্যাটাগরি</label>
                  <select
                    value={spareCategory}
                    onChange={e => setSpareCategory(e.target.value as CategoryCode)}
                    className="w-full p-1.5 border rounded dark:bg-slate-800 text-xs"
                  >
                    <option value="01">প্রাথমিক (০১)</option>
                    <option value="02">নিম্ন মাধ্যমিক (০২)</option>
                    <option value="03">মাধ্যমিক (০৩)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-700 dark:text-gray-300 mb-0.5">শুরুর ক্রমিক</label>
                  <input
                    type="number"
                    value={spareFirst}
                    onChange={e => setSpareFirst(parseInt(e.target.value, 10) || 801)}
                    className="w-full p-1.5 border rounded dark:bg-slate-800 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-700 dark:text-gray-300 mb-0.5">ফর্ম সংখ্যা</label>
                  <input
                    type="number"
                    value={spareCount}
                    onChange={e => setSpareCount(parseInt(e.target.value, 10) || 10)}
                    className="w-full p-1.5 border rounded dark:bg-slate-800 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-700 dark:text-gray-300 mb-0.5">ভেন্যু</label>
                  <select
                    value={spareVenueId}
                    onChange={e => setSpareVenueId(e.target.value)}
                    className="w-full p-1.5 border rounded dark:bg-slate-800 text-xs"
                  >
                    {venues.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddingSpare(false)}
                  className="px-2.5 py-1 border rounded text-xs text-gray-600 hover:bg-gray-100"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  onClick={handleAddSpareBlock}
                  className="px-3 py-1 bg-amber-600 text-white rounded text-xs font-semibold hover:bg-amber-700"
                >
                  স্পেয়ার ব্লক যোগ করুন
                </button>
              </div>
            </div>
          )}

          {/* Preview Table */}
          <div className="border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-gray-300 font-semibold sticky top-0 border-b border-gray-200 dark:border-slate-700">
                  <tr>
                    <th className="py-2 px-3">বিদ্যালয়</th>
                    <th className="py-2 px-3">ক্যাটাগরি</th>
                    <th className="py-2 px-2 text-center">সংখ্যা</th>
                    <th className="py-2 px-3 text-center">প্রথম আইডি</th>
                    <th className="py-2 px-3 text-center">শেষ আইডি</th>
                    <th className="py-2 px-3">ভেন্যু</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-gray-800 dark:text-gray-200">
                  {allocation.previewRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-slate-800/40">
                      <td className="py-2 px-3 font-medium">
                        {row.schoolName}
                      </td>
                      <td className="py-2 px-3">
                        <span className="font-semibold">
                          {row.category === '01' ? 'প্রাথমিক' : row.category === '02' ? 'নিম্ন মাধ্যমিক' : 'মাধ্যমিক'}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-center font-mono font-bold">
                        {toBengaliDigits(row.count)}
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {row.firstId}
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {row.lastId}
                      </td>
                      <td className="py-2 px-3 text-gray-600 dark:text-gray-400">
                        {row.venueName}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Allocation Category Summary */}
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            {(['01', '02', '03'] as CategoryCode[]).map(cat => {
              const summary = allocation.summaryByCategory[cat];
              return (
                <div key={cat} className="p-2.5 rounded-lg border bg-gray-50 dark:bg-slate-800/60 border-gray-200 dark:border-slate-700">
                  <span className="font-bold text-gray-800 dark:text-gray-200 block mb-0.5">
                    ক্যাটাগরি {cat} সারাংশ:
                  </span>
                  <div className="text-gray-600 dark:text-gray-400 space-y-0.5">
                    <p>মোট ফরম: <span className="font-bold text-gray-900 dark:text-white font-mono">{summary.totalSchoolForms}</span></p>
                    <p>সর্বশেষ ক্রমিক: <span className="font-bold text-gray-900 dark:text-white font-mono">{summary.lastSchoolSerial || '০'}</span></p>
                    <p>অবশিষ্ট ধারণক্ষমতা: <span className="font-bold text-green-600 font-mono">{summary.capacityLeft}</span></p>
                  </div>
                </div>
              );
            })}
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-slate-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 text-xs font-semibold"
          >
            বাতিল
          </button>
          <button
            onClick={handleSave}
            disabled={!allocation.success || isSaving}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-2 disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span>{isSaving ? 'সংরক্ষণ করা হচ্ছে...' : 'ব্লক চূড়ান্ত ও সংরক্ষণ করুন'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
