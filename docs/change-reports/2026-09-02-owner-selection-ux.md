# Sahibkar seçimi UX hesabatı

Tarix: 2026-09-02
Branch: `feature/profile-session-management`

## Məqsəd

Restoran yaratma səhifəsində sahibkar məlumatları əvvəl ID, email və yeni sahibkar sahələrini eyni anda göstərirdi. Bu istifadəçi üçün qarışıq idi: mövcud sahibkar seçilir, yoxsa yeni sahibkar yaradılır aydın görünmürdü. Yeni dəyişiklik sahibkar seçimini iki aydın rejimə ayırır.

## Dəyişən fayllar

- `src/pages/admin/RestaurantManagementPage.tsx`
  - `Mövcud sahibkar` və `Yeni sahibkar` seçim rejimləri əlavə edildi.
  - Mövcud sahibkar ID sahəsi istifadəçi interfeysindən çıxarıldı.
  - Sahibkar email/telefon/ad/soyad üzrə lokal axtarış nəticələri kart şəklində göstərilir.
  - Seçilmiş sahibkar ayrıca kart ilə təsdiqlənir.
  - Yeni sahibkar yaratma sahələri yalnız `Yeni sahibkar` rejimi seçiləndə görünür.
  - `/admin/users` sorğusu yalnız restoran yaratma rejimində və platform admin üçün işləyir; list səhifəsində lazımsız sorğu getmir.
  - Submit zamanı sahibkar məlumatları üçün daha aydın frontend validation mesajları əlavə edildi.

- `src/styles/globals.css`
  - Sahibkar seçim rejimləri, nəticə kartları, seçilmiş sahibkar kartı və boş nəticə mesajı üçün responsive stillər əlavə edildi.
  - Mobil ekranda seçim və nəticə kartları tək sütuna düşür.

## Backend uyğunluğu

Bu dəyişiklik mövcud backend request formasını pozmur. Restoran yaratma zamanı əvvəlki kimi `Owner.Id`, `Owner.SearchText`, `Owner.Email`, `Owner.Phone`, `Owner.FirstName`, `Owner.LastName` göndərilir. Mövcud sahibkar seçiləndə `Owner.Id` göndərilir; yeni sahibkar rejimində isə yeni sahibkar məlumatları göndərilir.

## Qeyd

Personal əlavə etmə axını ayrıca mövzudur. Backend-də `CreateUserAsync` hazırda email və telefon mövcuddursa istifadəçi yaratmağı dayandırır. Ona görə mövcud istifadəçini başqa restoran və başqa rol ilə personal kimi əlavə etmək üçün backend-də ayrıca assignment məntiqi əlavə edilməlidir.

## Yoxlama

Bu hesabatdan sonra `npm run build` ilə TypeScript və Vite build yoxlanmalıdır.
