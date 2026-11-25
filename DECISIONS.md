# MBP Math Quiz Management System — Architectural Decisions (DECISIONS.md)

This document records the simplest, secure architectural and design decisions made where the specification was silent or allowed implementation discretion.

## 1. School PIN Security & Bundle Cover Storage
- **Decision:** School 4-digit PINs are stored as cryptographically hashed values (SHA-256 / bcrypt) in the `schools` collection (`pinHash`).
- **Rationale:** Section 13 mandates that teacher PINs are stored hashed to prevent credential leaks. To allow bundle cover printing without storing reversible plaintext in the database, the plain PIN is generated client-side during school creation or regeneration, displayed once to the admin, and printed onto the cover sheet PDF. Regenerating a PIN invalidates any previous session tokens for that school.

## 2. Registration ID and QR Code Format
- **Decision:** Registration ID format is standard 7 digits: `YYCCSSS` (e.g., `2601001` where `26` is year 2026, `01` is Primary category, `001` is serial).
- **QR Code Content:** Exactly prefixed as `MBPQ26:<ID>` (e.g., `MBPQ26:2601001`), matching Section 12 ("QR contains only the registration ID, prefixed MBPQ26:").

## 3. Category Color Coding & Print Compatibility
- **Decision:**
  - Category 01 (Primary): Sky Blue (`#0284c7`)
  - Category 02 (Lower Secondary): Emerald Green (`#059669`)
  - Category 03 (Secondary): Amber / Gold (`#d97706`)
- **Print Optimization:** The forms include a prominent 6mm color category banner across the top header of both the registration form and admit card. Furthermore, all borders, fonts, and text are high-contrast grayscale so that monochrome (black and white) laser/photocopy printing remains 100% legible, crisp, and ink-efficient.

## 4. Bengali Font & Conjunct Rendering in PDFs
- **Decision:** Use Google Fonts **Hind Siliguri** and **Noto Sans Bengali** loaded as web fonts with `font-display: block` and CSS `@media print` layout.
- **Rationale:** Client-side jsPDF raw text rendering famously breaks Bengali complex conjuncts (যুক্তাক্ষর যেমন: ক্ষ, ঙ্ক, ঙ্গ, জ্ঞ, ঞ্চ, ঞ্জ, ণ্ট, ণ্ঠ, ণ্ড, ণ্ণ, ত্ত, থ্থ, দ্দ, ধ্ধ, ন্ন, প্প, ব্ব, ভ্ভ, ম্ম, য্য, ল্ল, শ্ল, ষ্প, ষ্ট, ষ্ঠ, ষ্ফ, স্ম, স্খ, স্ত, স্থ, স্ন, স্প, স্ফ, স্ব, স্র, স্ল, হ্ন, হ্ম, হ্ল, ইত্যাদি). Modern browser rendering engines (Chromium / Firefox / Safari) utilize full HarfBuzz script shaping. The print view renders directly via semantic HTML/CSS and browser vector print dialog, ensuring 100% exact typographic glyph shaping.

## 5. Block Allocation Order & Reserved Online Serials
- **Decision:**
  - School blocks are allocated sequentially starting at serial `001` for each category based on school creation order.
  - Serials `901–999` are strictly reserved for online registrants (`online-01`, `online-02`, `online-03`).
  - Serials `801–900` are reserved as default spare blocks for emergency walk-ins or school form replenishment.
  - The block generation engine executes strict mathematical collision detection: no two blocks may ever have overlapping serial numbers within the same category.

## 6. Public vs. Admin Security Boundary
- **Decision:**
  - Public anonymous users are strictly forbidden from reading private collections (`students`, `applications`, `blocks`, `marks`, `seatPlans`, `results`, `auditLog`, `smsLog`, `users`).
  - Public users only have direct Firestore read access to `publicSettings`, `stats/live`, and basic school/venue public directory names.
  - All status lookups, admit card generation, and results queries are dispatched via secure server callable functions or backend API endpoints that apply rate limiting and data sanitization.

## 7. Class-Wise vs. Category-Wise Ranking System
- **Decision:**
  - Prizes (1st, 2nd, and 3rd place) are awarded **class-wise** for Classes 3 through 10 (each class has its own 1st, 2nd, and 3rd place winners).
  - Both class-wise rank (e.g. `১ম স্থান (শ্রেণি ৫)`) and category-wise overall rank (e.g. `ক্যাটাগরিতে সার্বিক ২য় স্থান`) are calculated server-authoritatively and displayed to students in individual result searches.
  - Ties in marks are resolved using student registration ID as deterministic tie-breaker.

## 8. Dedicated Public Results Search Modal
- **Decision:**
  - Separated "রেজিস্ট্রেশন যাচাই ও প্রবেশপত্র (Status Check & Admit Card)" and "ফলাফল ও সনদ (Results & Certificate)".
  - "ফলাফল ও সনদ" requires both 7-digit Registration ID and registered Mobile number for privacy.
  - Displays marks obtained (/100), class-wise podium award, and overall category position.
  - Provides English certificate download with dynamic verification QR code and digital PNG signatures.

## 9. Hamburger Navigation for Admin Phases
- **Decision:**
  - All 5 heading menus (১ক. ফরম ও ব্লক, ১খ. পেমেন্ট ও শিক্ষক, ২. সিট প্ল্যান ও ডাটা, ৩. লাইভ হাজিরা, ৪. ফলাফল ও সনদ) are consolidated into a responsive Hamburger Menu Drawer with accordion submenu expansion.
  - Keeps the admin header clean, accessible, and responsive across mobile, tablet, and desktop viewports.

## 10. Teacher Panel Zero-Clipping Standalone View
- **Decision:**
  - Rather than confining the extensive cinema number grid inside a nested modal popup, the teacher panel launcher in the public portal renders in a dedicated full-width responsive view with a top return button.
  - Guarantees 100% visibility of all category numbers without vertical or horizontal clipping on any screen size.

## 11. Digital PNG Signature Integration
- **Decision:**
  - Admins can upload high-resolution transparent PNG digital signatures for the 3 official signatories (Director General, Exam Controller, President).
  - Uploaded signatures are encoded to base64 / cloud storage URLs and automatically rendered onto the official English certificates before download or print.

## 12. Strict Single-Page A4 Form Print Optimization
- **Decision:**
  - In `PrintedFormSheet.tsx`, outer height is strictly bounded to `268mm` with `overflow: hidden` and CSS `break-after: page`.
  - Guarantees exactly 1 form per A4 page with zero 2-page spillover across standard desktop and mobile browser print dialogs.

## 13. Admin Authentication & Modal Streamlining
- **Decision:**
  - Configured direct authentication for administrator email `mbprojonmo@gmail.com` with password `mbp2026`.
  - Removed all plaintext password hints and demo version quick-access buttons from the login UI as requested.
  - Granted full `superadmin` role with persistent session storage in `mbp_admin_auth` to access all private phases (1a, 1b, 2, 3, and 4) through the Hamburger Menu.

## 14. 100% English Certificate & Official Signatory Update
- **Decision:**
  - Updated 3rd official signatory default from 'Swarup Kumar Singha, President' to 'Sujit Kumar Singha', post: 'Director'.
  - Enforced strict 100% English rendering on all generated/printed certificates: candidate name in Latin uppercase, automated English mapping for all participating schools, English ordinal placement ('1st Place Winner', '2nd Place (Runner-Up)', '3rd Place', '4th Place', etc.), English category titles ('Primary', 'Lower Secondary', 'Secondary'), and English signatory titles. Zero Bengali glyphs appear on certificates.
