import React, { useState } from 'react';
import {
  CategoryCode,
  CATEGORIES,
  ContestSettings,
  OnlineApplication,
  QuestionMedium,
  QUESTION_MEDIUM_LABELS,
  Student
} from '../../types';
import { getCategoryForClass } from '../../services/idSystem';
import { getNextOnlineRegistrationId } from '../../services/firestoreService';
import { normalizeBdMobile } from '../../services/smsService';
import { CreditCard, User, CheckCircle2, Copy, Check, Upload, ArrowRight, ArrowLeft, X, AlertCircle } from 'lucide-react';

interface OnlineRegistrationModalProps {
  settings: ContestSettings;
  existingApplications: OnlineApplication[];
  existingStudents?: Student[];
  onSubmitApplication: (app: Omit<OnlineApplication, 'id' | 'submittedAt' | 'status'>, assignedId: string) => Promise<string>;
  onClose: () => void;
  onOpenCheckStatus: (prefillId?: string) => void;
}

export const OnlineRegistrationModal: React.FC<OnlineRegistrationModalProps> = ({
  settings,
  existingApplications,
  existingStudents = [],
  onSubmitApplication,
  onClose,
  onOpenCheckStatus
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [copiedBkash, setCopiedBkash] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [assignedId, setAssignedId] = useState<string>('');

  // Step 1: Payment Details
  const [txnId, setTxnId] = useState('');
  const [payerMobile, setPayerMobile] = useState('');
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string>('');

  // Step 2: Student Details (English labels as requested)
  const [nameBn, setNameBn] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [motherName, setMotherName] = useState('');
  const [studentClass, setStudentClass] = useState<number>(5);
  const [mobile, setMobile] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [village, setVillage] = useState('');
  const [upazila, setUpazila] = useState('Kamalganj');
  const [district, setDistrict] = useState('Moulvibazar');
  const [questionMedium, setQuestionMedium] = useState<QuestionMedium>('bangla');
  const [photoDataUrl, setPhotoDataUrl] = useState<string>('');

  const derivedCategory: CategoryCode = getCategoryForClass(studentClass) || '01';
  const catInfo = CATEGORIES[derivedCategory];

  const handleCopyBkash = () => {
    navigator.clipboard.writeText(settings.bkashNumber);
    setCopiedBkash(true);
    setTimeout(() => setCopiedBkash(false), 2000);
  };

  const handleScreenshotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setScreenshotDataUrl(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Browser image compression to ~600px width/height
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (event) => {
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 600;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        setPhotoDataUrl(canvas.toDataURL('image/jpeg', 0.8));
      };
    };
    reader.readAsDataURL(file);
  };

  const validateStep1 = () => {
    setErrorMessage(null);
    const cleanTxn = txnId.trim().toUpperCase();
    if (!cleanTxn && !screenshotDataUrl) {
      setErrorMessage('Please provide either bKash TrxID or upload a payment screenshot.');
      return false;
    }
    if (cleanTxn) {
      const exists = existingApplications.some(
        a => a.txnId && a.txnId.toUpperCase() === cleanTxn
      );
      if (exists) {
        setErrorMessage('এই TrxID দিয়ে আগেই আবেদন করা হয়েছে। (This TrxID has already been used).');
        return false;
      }
    }
    return true;
  };

  const validateStep2 = () => {
    setErrorMessage(null);
    if (!nameBn.trim()) {
      setErrorMessage('Please enter student name in Bengali.');
      return false;
    }
    if (!nameEn.trim()) {
      setErrorMessage('Please enter student name in English (CAPITALS).');
      return false;
    }
    if (!fatherName.trim()) {
      setErrorMessage("Please enter father's name.");
      return false;
    }
    const cleanPhone = normalizeBdMobile(mobile);
    if (!/^01[3-9]\d{8}$/.test(cleanPhone)) {
      setErrorMessage('Please enter a valid 11-digit Bangladeshi mobile number (e.g. 01712345678).');
      return false;
    }
    if (!schoolName.trim()) {
      setErrorMessage('Please enter school name (or write: Self Initiative / নিজ উদ্যোগে).');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1) {
      if (validateStep1()) setStep(2);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep2()) return;

    setIsSubmitting(true);
    try {
      const nextIdInfo = getNextOnlineRegistrationId(
        derivedCategory,
        settings.yearCode || '26',
        existingApplications,
        existingStudents,
        settings.onlineSerialStart || 601
      );
      const generatedId = nextIdInfo.fullId;
      setAssignedId(generatedId);

      const normalizedApplicantMobile = normalizeBdMobile(mobile);
      const normalizedPayerMobile = payerMobile.trim()
        ? normalizeBdMobile(payerMobile)
        : normalizedApplicantMobile;

      await onSubmitApplication({
        nameBn: nameBn.trim(),
        nameEn: nameEn.trim().toUpperCase(),
        fatherName: fatherName.trim(),
        motherName: motherName.trim(),
        class: studentClass,
        category: derivedCategory,
        mobile: normalizedApplicantMobile,
        schoolName: schoolName.trim(),
        village: village.trim(),
        upazila: upazila.trim(),
        district: district.trim(),
        txnId: txnId.trim().toUpperCase(),
        payerMobile: normalizedPayerMobile,
        questionMedium,
        screenshotPath: screenshotDataUrl,
        photoPath: photoDataUrl
      }, generatedId);
      setStep(3);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Submission failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full shadow-2xl border border-gray-200 dark:border-slate-800 overflow-hidden flex flex-col text-xs">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-indigo-900 text-white flex justify-between items-center">
          <div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight">
              Online Registration — {settings.contestNameEn}
            </h2>
            <p className="text-indigo-200 text-xs">
              For independent students registering outside school bundles
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-indigo-300 hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3-Step Progress Indicator */}
        <div className="grid grid-cols-3 text-center border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-850 py-2.5 px-4 font-semibold text-xs">
          <div className={`flex items-center justify-center gap-1.5 ${step === 1 ? 'text-indigo-600 dark:text-indigo-400 font-bold' : step > 1 ? 'text-emerald-600' : 'text-gray-400'}`}>
            <span className="w-5 h-5 rounded-full border flex items-center justify-center text-[10px]">1</span>
            <span>Payment</span>
          </div>
          <div className={`flex items-center justify-center gap-1.5 ${step === 2 ? 'text-indigo-600 dark:text-indigo-400 font-bold' : step > 2 ? 'text-emerald-600' : 'text-gray-400'}`}>
            <span className="w-5 h-5 rounded-full border flex items-center justify-center text-[10px]">2</span>
            <span>Student Info</span>
          </div>
          <div className={`flex items-center justify-center gap-1.5 ${step === 3 ? 'text-emerald-600 font-bold' : 'text-gray-400'}`}>
            <span className="w-5 h-5 rounded-full border flex items-center justify-center text-[10px]">3</span>
            <span>Completed</span>
          </div>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="mx-4 mt-4 p-3 bg-red-50 dark:bg-red-950/50 border border-red-300 rounded-xl text-red-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Step 1: Payment Details */}
        {step === 1 && (
          <div className="p-5 space-y-4">
            
            {/* bKash Payment Instructions Card */}
            <div className="p-4 bg-pink-50 dark:bg-pink-950/30 border border-pink-200 dark:border-pink-900 rounded-xl space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-pink-900 dark:text-pink-200 font-bold text-sm">
                  bKash Send Money Instruction
                </span>
                <span className="font-mono font-bold text-sm px-2 py-0.5 bg-pink-100 dark:bg-pink-900 text-pink-800 dark:text-pink-100 rounded">
                  Fee: {settings.registrationFee} BDT
                </span>
              </div>
              <p className="text-gray-700 dark:text-gray-300 text-xs">
                Open bKash App or dial <strong>*247#</strong> &gt; Select <strong>Send Money</strong> &gt; Send <strong>{settings.registrationFee} BDT</strong> to the personal number below:
              </p>

              <div className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-pink-300">
                <div>
                  <span className="text-[10px] text-gray-500 block">Personal bKash Account:</span>
                  <span className="font-mono font-bold text-base text-gray-900 dark:text-white">
                    {settings.bkashNumber}
                  </span>
                  <span className="text-[11px] text-gray-500 ml-2">({settings.bkashAccountName})</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyBkash}
                  className="px-3 py-1.5 bg-pink-600 hover:bg-pink-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs"
                >
                  {copiedBkash ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedBkash ? 'Copied' : 'Copy Number'}</span>
                </button>
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-3">
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                  bKash Transaction ID (TrxID) *
                </label>
                <input
                  type="text"
                  value={txnId}
                  onChange={e => setTxnId(e.target.value.toUpperCase())}
                  placeholder="e.g. BL92XK4901"
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 font-mono font-bold uppercase tracking-wider text-sm"
                />
                <span className="text-[10px] text-gray-500">From the bKash confirmation SMS (8-12 alphanumeric characters)</span>
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Sender Mobile Number (Used to Send Money)
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={payerMobile}
                  onChange={e => setPayerMobile(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 font-mono text-sm"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Payment Screenshot (Optional if TrxID provided)
                </label>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer px-3 py-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 border rounded-xl text-xs font-semibold flex items-center gap-1.5">
                    <Upload className="w-4 h-4 text-gray-500" />
                    <span>Upload Screenshot</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleScreenshotUpload}
                      className="hidden"
                    />
                  </label>
                  {screenshotDataUrl && (
                    <span className="text-emerald-600 font-semibold text-xs flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Screenshot Attached
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleNext}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-1.5 text-xs shadow-md"
              >
                <span>Continue to Student Info</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Student Details Form */}
        {step === 2 && (
          <form onSubmit={handleSubmit} className="p-5 space-y-3.5 max-h-[70vh] overflow-y-auto">
            
            <div className="space-y-3">
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-0.5">
                  Student Name (in Bengali / বাংলা) *
                </label>
                <input
                  type="text"
                  required
                  value={nameBn}
                  onChange={e => setNameBn(e.target.value)}
                  placeholder="যেমন: শুভজিৎ সিংহ"
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-0.5">
                  Name in English (CAPITAL LETTERS) *
                </label>
                <input
                  type="text"
                  required
                  value={nameEn}
                  onChange={e => setNameEn(e.target.value.toUpperCase())}
                  placeholder="e.g. SHUVAJIT SINGHA"
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 uppercase font-medium text-xs"
                />
                <span className="text-[10px] text-gray-500">This exact spelling will appear on certificates</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-0.5">
                  Father's Name *
                </label>
                <input
                  type="text"
                  required
                  value={fatherName}
                  onChange={e => setFatherName(e.target.value)}
                  placeholder="Father's Name"
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-0.5">
                  Mother's Name (Optional)
                </label>
                <input
                  type="text"
                  value={motherName}
                  onChange={e => setMotherName(e.target.value)}
                  placeholder="Mother's Name"
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 text-xs"
                />
              </div>
            </div>

            {/* Class and Auto-Category */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-0.5">
                  Class (শ্রেণি) *
                </label>
                <select
                  value={studentClass}
                  onChange={e => setStudentClass(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 text-xs font-semibold"
                >
                  <option value={3}>Class 3</option>
                  <option value={4}>Class 4</option>
                  <option value={5}>Class 5</option>
                  <option value={6}>Class 6</option>
                  <option value={7}>Class 7</option>
                  <option value={8}>Class 8</option>
                  <option value={9}>Class 9</option>
                  <option value={10}>Class 10</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-0.5">
                  Auto Category
                </label>
                <div className={`px-3 py-2 rounded-xl border font-bold text-xs ${catInfo.badgeBg} ${catInfo.textColor} ${catInfo.borderColor}`}>
                  {catInfo.nameEn} ({catInfo.nameBn})
                </div>
              </div>
            </div>

            {/* Quiz Question Type / Medium ('প্রশ্নের ধরন') */}
            <div>
              <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                প্রশ্নের ধরন (Quiz Question Medium) *
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {(['bangla', 'english'] as QuestionMedium[]).map(med => {
                  const isSelected = questionMedium === med;
                  const label = QUESTION_MEDIUM_LABELS[med];
                  return (
                    <button
                      key={med}
                      type="button"
                      onClick={() => setQuestionMedium(med)}
                      aria-pressed={isSelected}
                      className={`px-3 py-2.5 rounded-xl border-2 text-left transition flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-950 dark:text-indigo-100 shadow-xs'
                          : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:border-indigo-300'
                      }`}
                    >
                      <div>
                        <span className="font-bold block text-xs">{label.en}</span>
                        <span className="text-[11px] opacity-80 block">{label.bn}</span>
                      </div>
                      <span
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-600 text-white'
                            : 'border-gray-300 dark:border-slate-600'
                        }`}
                      >
                        {isSelected && <Check className="w-2.5 h-2.5" />}
                      </span>
                    </button>
                  );
                })}
              </div>
              <span className="text-[10px] text-gray-500 mt-1 block">
                আপনি যে ভাষার প্রশ্নপত্রে পরীক্ষা দিতে ইচ্ছুক তা নির্বাচন করুন (Bangla or English Medium)
              </span>
            </div>

            {/* Mobile & Photo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-0.5">
                  Student / Parent Mobile *
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  required
                  value={mobile}
                  onChange={e => setMobile(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 font-mono text-xs"
                />
                <span className="text-[10px] text-gray-500">Admit card confirmation SMS will be sent here</span>
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-0.5">
                  Student Passport Photo (Optional)
                </label>
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer px-3 py-2 bg-gray-100 dark:bg-slate-800 border rounded-xl text-xs font-semibold flex items-center gap-1">
                    <Upload className="w-3.5 h-3.5 text-gray-500" />
                    <span>Upload Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                  {photoDataUrl && (
                    <img src={photoDataUrl} alt="Preview" className="w-8 h-8 rounded-full object-cover border" />
                  )}
                </div>
              </div>
            </div>

            {/* School Name */}
            <div>
              <label className="block font-bold text-gray-700 dark:text-gray-300 mb-0.5">
                School Name *
              </label>
              <input
                type="text"
                required
                value={schoolName}
                onChange={e => setSchoolName(e.target.value)}
                placeholder="e.g. Tetaigaon High School"
                className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 text-xs"
              />
              <span className="text-[10px] text-gray-500">Hint: If not attending school, write: "Self Initiative" or "নিজ উদ্যোগে"</span>
            </div>

            {/* Address */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-0.5">Village / Para</label>
                <input
                  type="text"
                  value={village}
                  onChange={e => setVillage(e.target.value)}
                  placeholder="Village"
                  className="w-full px-2 py-1.5 border rounded-lg dark:bg-slate-800 text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-0.5">Upazila</label>
                <input
                  type="text"
                  value={upazila}
                  onChange={e => setUpazila(e.target.value)}
                  placeholder="Upazila"
                  className="w-full px-2 py-1.5 border rounded-lg dark:bg-slate-800 text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-0.5">District</label>
                <input
                  type="text"
                  value={district}
                  onChange={e => setDistrict(e.target.value)}
                  placeholder="District"
                  className="w-full px-2 py-1.5 border rounded-lg dark:bg-slate-800 text-xs"
                />
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-between items-center pt-3 border-t border-gray-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 border rounded-xl text-gray-600 dark:text-gray-300 text-xs font-semibold flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md flex items-center gap-1.5 transition"
              >
                <Check className="w-4 h-4" />
                <span>{isSubmitting ? 'Submitting...' : 'Submit Application'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Success Screen */}
        {step === 3 && (
          <div className="p-6 sm:p-8 text-center space-y-4 my-2">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/60 rounded-full flex items-center justify-center mx-auto text-emerald-600">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              আবেদন সফলভাবে জমা হয়েছে!
            </h3>
            
            {/* Prominent Reserved Registration ID Card */}
            <div className="p-4 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/70 dark:to-slate-900 border-2 border-indigo-500 rounded-2xl max-w-sm mx-auto shadow-md">
              <p className="text-[11px] text-indigo-700 dark:text-indigo-300 font-bold uppercase tracking-wider">
                আপনার বরাদ্দকৃত রেজিস্ট্রেশন নম্বর (Registration ID)
              </p>
              <div className="text-3xl font-extrabold font-mono text-indigo-950 dark:text-yellow-300 my-1 tracking-widest">
                {assignedId}
              </div>
              <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span>স্ট্যাটাস: পেমেন্ট যাচাই অপেক্ষমান (Pending)</span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 max-w-md mx-auto leading-relaxed">
              অ্যাডমিন bKash ট্রানজ্যাকশন আইডি যাচাই করে অনুমোদন দিলে এই নম্বরের বিপরীতে প্রবেশপত্র (Admit Card) প্রস্তুত হবে। আপনার মোবাইল (<strong className="font-mono text-indigo-600 dark:text-indigo-400">{mobile}</strong>) নম্বরেও SMS পাঠানো হবে।
            </p>

            <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-xl max-w-sm mx-auto text-gray-600 dark:text-gray-400 text-xs text-left space-y-1">
              <p className="flex justify-between">
                <span>শিক্ষার্থীর নাম:</span> 
                <strong className="text-gray-900 dark:text-white">{nameBn} ({nameEn})</strong>
              </p>
              <p className="flex justify-between">
                <span>TrxID:</span> 
                <strong className="font-mono text-gray-900 dark:text-white">{txnId || 'Screenshot Attached'}</strong>
              </p>
              <p className="flex justify-between">
                <span>ক্যাটাগরি:</span> 
                <strong className="text-gray-900 dark:text-white">{catInfo.nameBn} (শ্রেণি {studentClass})</strong>
              </p>
              <p className="flex justify-between">
                <span>প্রশ্নের ধরন:</span>
                <strong className="text-indigo-700 dark:text-indigo-300">
                  {QUESTION_MEDIUM_LABELS[questionMedium].en} ({QUESTION_MEDIUM_LABELS[questionMedium].bn})
                </strong>
              </p>
              <p className="pt-1 text-[11px] text-gray-500 border-t border-gray-200 dark:border-slate-700">
                হেল্পলাইন: {settings.helplineNumbers}
              </p>
            </div>

            <div className="flex justify-center gap-3 pt-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border rounded-xl font-semibold text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                বন্ধ করুন
              </button>

              <button
                onClick={() => {
                  onClose();
                  onOpenCheckStatus(assignedId);
                }}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center gap-1.5"
              >
                <span>আবেদনের অবস্থা যাচাই করুন</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
